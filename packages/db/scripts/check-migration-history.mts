// Dry run of the drizzle v1 history upgrade. Reads `__drizzle_migrations` with
// one SELECT, copies it to a local temp database and runs the migrator there.
// DATABASE_URL=… DATABASE_AUTH_TOKEN=… node scripts/check-migration-history.mts
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

import { env } from "../env.mjs";

const migrationsFolder = join(import.meta.dirname, "../drizzle");
const folders = readdirSync(migrationsFolder).sort();

const source = createClient({
  url: env.DATABASE_URL,
  authToken: env.DATABASE_AUTH_TOKEN,
});
const history = await source.execute("SELECT * FROM __drizzle_migrations");
source.close();
console.log(
  `${history.rows.length} history rows, ${folders.length} local migrations`,
);
if (history.columns.includes("name")) {
  console.log("The history table is already in the v1 format.");
}

const dir = mkdtempSync(join(tmpdir(), "migration-history-"));
const copy = createClient({ url: `file:${join(dir, "copy.db")}` });
let failure: unknown;
try {
  // `SERIAL` is not a rowid alias in SQLite: v0 left every `id` NULL.
  const types: Record<string, string> = {
    id: "SERIAL PRIMARY KEY",
    hash: "text NOT NULL",
    created_at: "numeric",
  };
  await copy.execute(
    `CREATE TABLE __drizzle_migrations (${history.columns.map((c) => `"${c}" ${types[c] ?? "text"}`).join(", ")})`,
  );
  for (const row of history.rows) {
    await copy.execute({
      sql: `INSERT INTO __drizzle_migrations VALUES (${history.columns.map(() => "?").join(", ")})`,
      args: history.columns.map((c) => row[c] ?? null),
    });
  }

  // The copy has no other table, so a pending migration fails here. That is
  // fine: what would run is read from the names the upgrade matched.
  try {
    await migrate(drizzle({ client: copy }), { migrationsFolder });
  } catch (err) {
    failure = err;
  }

  const after = await copy.execute("SELECT * FROM __drizzle_migrations");
  if (!after.columns.includes("name")) throw failure;
  const matched = new Set(
    after.rows.slice(0, history.rows.length).map((r) => r.name),
  );
  const pending = folders.filter((f) => !matched.has(f));
  if (pending.length > 0) {
    console.error(`WOULD RUN ${pending.length}:\n  ${pending.join("\n  ")}`);
    process.exitCode = 1;
  } else if (failure) {
    throw failure;
  } else {
    console.log("OK: every migration matched, nothing would run.");
  }
} catch (err) {
  console.error("FAILED:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  copy.close();
  rmSync(dir, { recursive: true, force: true });
}
