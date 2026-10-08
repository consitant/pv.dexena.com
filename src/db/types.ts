import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type * as schema from "./schema";

/** Gemeinsamer DB-Typ für Neon (Produktion) und PGlite (Tests) – alle Core-Funktionen bekommen `db` injiziert. */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;
