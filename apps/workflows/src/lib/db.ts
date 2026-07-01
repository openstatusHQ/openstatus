import { schema } from "@openstatus/db";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "libsql";

import { env } from "../env";

// Use the `libsql` client (better-sqlite3 API) rather than `@libsql/client`: the
// latter rebuilds every result row via Object.defineProperty, ~3x more CPU on
// Deno's V8. Same libsql engine + embedded replica, but plain-object rows.
const file =
  env().NODE_ENV === "development" ? "./dev.db" : "/app/data/replica.db";

// libsql's typings (better-sqlite3-derived) omit its embedded-replica options;
// they're read at runtime (see libsql/index.js).
type ReplicaOptions = Database.Options & {
  authToken?: string;
  syncPeriod?: number;
};

const options: ReplicaOptions = {
  syncUrl: env().DATABASE_URL,
  authToken: env().DATABASE_AUTH_TOKEN,
  syncPeriod: 60,
};

export const db = drizzle(new Database(file, options), { schema });
