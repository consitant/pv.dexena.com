import "server-only";
import type { Db } from "@/db/types";
import { listAllSites, listCustomers, listDevices, suggestNextPort } from "@/lib/admin";
import type { InverterFormOptions } from "./inverter-fields";

export const STICK_HOST = "solarmax.dexena.com";

export async function loadInverterFormOptions(db: Db): Promise<InverterFormOptions> {
  const [devs, customerList, siteList] = await Promise.all([listDevices(db), listCustomers(db), listAllSites(db)]);
  const devices = await Promise.all(
    devs.map(async (d) => ({ id: d.id, name: d.name, nextPort: await suggestNextPort(db, d.id) })),
  );
  return {
    devices,
    customers: customerList.map((c) => ({ id: c.id, name: c.name })),
    sites: siteList.map((s) => ({ id: s.id, name: s.name, customerId: s.customerId })),
    host: STICK_HOST,
  };
}
