import type { SQL } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type * as schema from "./schema";

/** Gemeinsamer DB-Typ für Neon (Produktion) und PGlite (Tests) – alle Core-Funktionen bekommen `db` injiziert. */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

export type ExecResult<T> = { rows: T[]; rowCount?: number | null; affectedRows?: number };

/** Rohes SQL ausführen – vereinheitlicht die Ergebnisform von Neon (node-postgres) und PGlite. */
export async function exec<T = Record<string, unknown>>(db: Db, query: SQL): Promise<ExecResult<T>> {
  return (await db.execute(query)) as unknown as ExecResult<T>;
}

export function affected(res: ExecResult<unknown>): number {
  return res.rowCount ?? res.affectedRows ?? 0;
}
