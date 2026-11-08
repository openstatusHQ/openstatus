import { readFileSync } from "node:fs";

import { createClient } from "@libsql/client";
import { describe, expect, it } from "vitest";

import { frozenMonitorUptimeDaySchema } from "../index";

const migration = readFileSync(
  new URL(
    "../../../drizzle/0097_frozen_uptime_requests_shape.sql",
    import.meta.url,
  ),
  "utf8",
);

const legacy = [
  { day: "2026-10-01", ok: 1712, degraded: 4, error: 12 },
  { day: "2026-10-02", ok: 0, degraded: 0, error: 0 },
  { day: "2026-10-03", ok: 288, degraded: 0, error: 1 },
];
const migrated = [
  { day: "2026-10-01", requests: { ok: 1712, degraded: 4, error: 12 } },
  { day: "2026-10-02", requests: { ok: 0, degraded: 0, error: 0 } },
  { day: "2026-10-03", requests: { ok: 288, degraded: 0, error: 1 } },
];
const current = [
  {
    day: "2026-11-01",
    requests: { ok: 1712, degraded: 4, error: 12 },
    runs: { ok: 284, degraded: 1, error: 3 },
  },
];

async function migrate(rows: unknown[][]) {
  const db = createClient({ url: ":memory:" });
  await db.execute(
    "CREATE TABLE `frozen_monitor_uptime` (`id` integer PRIMARY KEY NOT NULL, `days` text NOT NULL)",
  );
  for (const [id, days] of rows.entries()) {
    await db.execute({
      sql: "INSERT INTO `frozen_monitor_uptime` (`id`, `days`) VALUES (?, ?)",
      args: [id, JSON.stringify(days)],
    });
  }
  const run = async () => {
    for (const statement of migration.split("--> statement-breakpoint")) {
      await db.execute(statement);
    }
  };
  await run();
  await run();
  const { rows: out } = await db.execute(
    "SELECT `days` FROM `frozen_monitor_uptime` ORDER BY `id`",
  );
  return out.map((row) => JSON.parse(String(row.days)));
}

describe("migration 0097", () => {
  it("rewrites flat days to requests, keeping order, idempotently", async () => {
    const [legacyRow, currentRow, mixedRow, emptyRow] = await migrate([
      legacy,
      current,
      [legacy[0], current[0]],
      [],
    ]);
    expect(legacyRow).toEqual(migrated);
    expect(currentRow).toEqual(current);
    expect(mixedRow).toEqual([migrated[0], current[0]]);
    expect(emptyRow).toEqual([]);
  });
});

describe("frozenMonitorUptimeDaySchema", () => {
  it("reads a legacy flat day as requests", () => {
    expect(frozenMonitorUptimeDaySchema.parse(legacy[0])).toEqual(migrated[0]);
  });

  it("keeps requests and checks", () => {
    expect(frozenMonitorUptimeDaySchema.parse(current[0])).toEqual(current[0]);
  });

  it("rejects a day without counts", () => {
    expect(
      frozenMonitorUptimeDaySchema.safeParse({ day: "2026-11-01" }).success,
    ).toBe(false);
  });
});
