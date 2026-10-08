import { asc, eq } from "drizzle-orm";
import type { Db } from "@/db/types";
import { inverters } from "@/db/schema";
import type { AuthedDevice } from "./device-auth";

export type GatewayConfig = {
  pollIntervalS: number;
  inverters: { ref: string; port: number; enabled: boolean }[];
};

/** Port-Zuordnung nur für dieses Device. */
export async function getGatewayConfig(db: Db, device: AuthedDevice): Promise<GatewayConfig> {
  const rows = await db
    .select({ ref: inverters.ref, port: inverters.port, enabled: inverters.enabled })
    .from(inverters)
    .where(eq(inverters.deviceId, device.id))
    .orderBy(asc(inverters.port));
  return { pollIntervalS: device.pollIntervalS, inverters: rows };
}
