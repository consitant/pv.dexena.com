import { config } from "dotenv";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as schema from "../src/db/schema";
import type { Db } from "../src/db/types";

config({ path: ".env.local", quiet: true });
config({ quiet: true });

if (typeof globalThis.WebSocket === "undefined") neonConfig.webSocketConstructor = ws;

export function openDb(): { db: Db; close: () => Promise<void> } {
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL fehlt (.env.local)");
  const pool = new Pool({ connectionString: url, max: 1 });
  return { db: drizzle({ client: pool, schema }), close: () => pool.end() };
}
