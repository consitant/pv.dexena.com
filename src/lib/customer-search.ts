/** Kundenliste im Admin: Suche, Filter, Sortierung, Pagination. Nur aus Admin-Kontext aufrufen. */
import { sql } from "drizzle-orm";
import { z } from "zod";
import { exec, type Db } from "@/db/types";
import { deriveStatus, type InverterStatus } from "./portal-data";
import { berlinDay } from "./time";

export const customerQuerySchema = z.object({
  q: z.string().trim().max(100).catch(""),
  status: z.enum(["all", "active", "inactive"]).catch("all"),
  health: z.enum(["all", "fault", "stale"]).catch("all"),
  sort: z.enum(["customerNo", "name", "city", "kwp", "monthWh", "lastData", "status"]).catch("customerNo"),
  dir: z.enum(["asc", "desc"]).catch("asc"),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
});
export type CustomerQuery = z.infer<typeof customerQuerySchema>;

export type Ampel = "green" | "yellow" | "red" | "grey";

export type CustomerRow = {
  id: string;
  customerNo: string;
  name: string;
  city: string | null;
  email: string | null;
  active: boolean;
  tags: string[];
  sites: number;
  inverters: number;
  kwp: number | null;
  monthWh: number;
  lastData: Date | null;
  ampel: Ampel;
};

export const PAGE_SIZE = 25;

/** Ampel aus den Wechselrichter-Status: rot = Fehler/Offline am Tag, gelb = unklar, grün = ok/Nachtruhe. */
export function ampelOf(statuses: InverterStatus[]): Ampel {
  if (statuses.length === 0) return "grey";
  if (statuses.some((s) => s === "error" || s === "offline")) return "red";
  if (statuses.some((s) => s === "unknown" || s === "shutdown" || s === "initial")) return "yellow";
  return "green";
}

export async function searchCustomers(db: Db, query: Partial<CustomerQuery>, now: Date = new Date()) {
  const q = customerQuerySchema.parse(query);
  const monthStart = `${berlinDay(now).slice(0, 7)}-01`;

  const [custRes, invRes] = await Promise.all([
    exec<{
      id: string; customer_no: string; name: string; city: string | null; email: string | null; active: boolean;
      tags: string[] | string; sites: number; site_kwp: number | null; month_wh: number | string | null;
    }>(
      db,
      sql`SELECT c.id, c.customer_no, c.name, c.city, c.email, c.active, c.tags,
                 (SELECT count(*)::int FROM sites s WHERE s.customer_id = c.id) AS sites,
                 (SELECT sum(s.peak_power_kwp) FROM sites s WHERE s.customer_id = c.id) AS site_kwp,
                 (SELECT sum(d.energy_wh) FROM daily_yield d JOIN inverters i ON i.id = d.inverter_id
                   WHERE i.customer_id = c.id AND d.day >= ${monthStart}::date) AS month_wh
          FROM customers c`,
    ),
    exec<{
      customer_id: string; connected: boolean; last_ok_at: string | Date | null; rated_power_w: number | null;
      enabled: boolean; ts: string | Date | null; mode: number | null; ac_power_w: number | null;
    }>(
      db,
      sql`SELECT i.customer_id, i.connected, i.last_ok_at, i.rated_power_w, i.enabled, m.ts, m.mode, m.ac_power_w
          FROM inverters i
          LEFT JOIN LATERAL (
            SELECT ts, mode, ac_power_w FROM measurements WHERE inverter_id = i.id ORDER BY ts DESC LIMIT 1
          ) m ON true
          WHERE i.customer_id IS NOT NULL`,
    ),
  ]);

  const invByCustomer = new Map<string, typeof invRes.rows>();
  for (const r of invRes.rows) {
    const list = invByCustomer.get(String(r.customer_id)) ?? [];
    list.push(r);
    invByCustomer.set(String(r.customer_id), list);
  }

  let rows: CustomerRow[] = custRes.rows.map((c) => {
    const invs = invByCustomer.get(String(c.id)) ?? [];
    const enabled = invs.filter((i) => i.enabled);
    const statuses = enabled.map((i) =>
      deriveStatus(
        { connected: i.connected, lastOkAt: i.last_ok_at ? new Date(i.last_ok_at) : null },
        i.ts ? { ts: new Date(i.ts), mode: i.mode, acPowerW: i.ac_power_w === null ? null : Number(i.ac_power_w) } : null,
        now,
      ),
    );
    const lastTimes = invs.map((i) => (i.ts ? new Date(i.ts).getTime() : 0)).filter((t) => t > 0);
    const ratedKw = invs.every((i) => i.rated_power_w) && invs.length ? invs.reduce((a, i) => a + (i.rated_power_w ?? 0), 0) / 1000 : null;
    return {
      id: String(c.id),
      customerNo: c.customer_no,
      name: c.name,
      city: c.city,
      email: c.email,
      active: c.active,
      tags: Array.isArray(c.tags) ? c.tags : parsePgArray(c.tags),
      sites: Number(c.sites),
      inverters: invs.length,
      kwp: c.site_kwp !== null ? Number(c.site_kwp) : ratedKw,
      monthWh: Number(c.month_wh ?? 0),
      lastData: lastTimes.length ? new Date(Math.max(...lastTimes)) : null,
      ampel: ampelOf(statuses),
    };
  });

  // Suche (Name, Kundennr., E-Mail, Ort, Tags)
  if (q.q) {
    const needle = q.q.toLowerCase();
    rows = rows.filter((r) =>
      [r.name, r.customerNo, r.email ?? "", r.city ?? "", ...r.tags].some((f) => f.toLowerCase().includes(needle)),
    );
  }
  if (q.status !== "all") rows = rows.filter((r) => r.active === (q.status === "active"));
  if (q.health === "fault") rows = rows.filter((r) => r.ampel === "red");
  if (q.health === "stale") {
    const cutoff = now.getTime() - 24 * 3600 * 1000;
    rows = rows.filter((r) => r.inverters > 0 && (!r.lastData || r.lastData.getTime() < cutoff));
  }

  const ampelRank: Record<Ampel, number> = { red: 0, yellow: 1, grey: 2, green: 3 };
  const val = (r: CustomerRow): string | number => {
    switch (q.sort) {
      case "customerNo": return r.customerNo;
      case "name": return r.name.toLowerCase();
      case "city": return (r.city ?? "").toLowerCase();
      case "kwp": return r.kwp ?? -1;
      case "monthWh": return r.monthWh;
      case "lastData": return r.lastData?.getTime() ?? 0;
      case "status": return ampelRank[r.ampel];
    }
  };
  rows.sort((a, b) => {
    const x = val(a);
    const y = val(b);
    const c = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "de");
    return q.dir === "asc" ? c : -c;
  });

  const total = rows.length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(q.page, pages);
  return { query: { ...q, page }, total, pages, rows: rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) };
}

function parsePgArray(v: string | null): string[] {
  if (!v || v === "{}") return [];
  return v
    .replace(/^\{|\}$/g, "")
    .split(",")
    .map((s) => s.replace(/^"|"$/g, ""));
}
