import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as schema from "./schema";
import type { Db } from "./types";

if (typeof globalThis.WebSocket === "undefined") {
  neonConfig.webSocketConstructor = ws;
}

let cached: Db | undefined;

/** Lazy erzeugte Drizzle-Instanz (Neon Pool über WebSocket, unterstützt Transaktionen). */
export function getDb(): Db {
  if (cached) return cached;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL ist nicht gesetzt");
  const pool = new Pool({ connectionString, max: 5, idleTimeoutMillis: 10_000 });
  pool.on("error", (err: Error) => console.error("[db] Pool-Fehler:", err.message));
  cached = drizzle({ client: pool, schema });
  return cached;
}
