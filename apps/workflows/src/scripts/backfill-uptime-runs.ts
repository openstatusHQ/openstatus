import { parseArgs } from "node:util";

import {
  backfillFrozenRuns,
  uptimeRunsBackfillPipes,
} from "@openstatus/services/frozen-uptime";
import { OSTinybird } from "@openstatus/tinybird";

import { env } from "../env";

const MONTH_THROTTLE_MS = 2_000;

function parseMonth(value: string, flag: string): Date {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  const month = match ? Number(match[2]) : 0;
  if (!match || month < 1 || month > 12) {
    throw new Error(`--${flag} must be YYYY-MM, got "${value}"`);
  }
  return new Date(Date.UTC(Number(match[1]), month - 1, 1));
}

// newest first: raw retention ends somewhere in the past, so the first empty
// month marks where to stop
function monthsNewestFirst(from: Date, to: Date): string[] {
  const out: string[] = [];
  for (
    const d = new Date(to);
    d.getTime() >= from.getTime();
    d.setUTCMonth(d.getUTCMonth() - 1)
  ) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

const { values } = parseArgs({
  args: process.argv.slice(2).filter((arg) => arg !== "--"),
  options: {
    from: { type: "string" },
    to: { type: "string" },
    monitor: { type: "string", multiple: true },
    "dry-run": { type: "boolean", default: false },
  },
});

if (!values.from || !values.to) {
  console.error(
    "usage: backfill:uptime-runs -- --from YYYY-MM --to YYYY-MM [--monitor <id>]... [--dry-run]",
  );
  process.exit(1);
}
const months = monthsNewestFirst(
  parseMonth(values.from, "from"),
  parseMonth(values.to, "to"),
);
if (months.length === 0) {
  console.error("--from must not be after --to");
  process.exit(1);
}
const monitorIds = values.monitor?.map((id) => {
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) {
    console.error(`--monitor must be a positive integer, got "${id}"`);
    process.exit(1);
  }
  return n;
});
const dryRun = values["dry-run"];

const config = env();
if (!config.TINY_BIRD_API_KEY || config.TINYBIRD_NOOP) {
  console.error(
    "TINY_BIRD_API_KEY is unset or TINYBIRD_NOOP is on: every month would read as empty",
  );
  process.exit(1);
}
const tb = new OSTinybird({
  token: config.TINY_BIRD_API_KEY,
  baseUrl: config.TINYBIRD_URL,
});
const pipes = uptimeRunsBackfillPipes(tb);

console.log(
  `[backfill-uptime-runs] ${months.length} month(s) ${months.at(-1)}..${months[0]}${dryRun ? " (dry run)" : ""}${monitorIds ? ` monitors ${monitorIds.join(",")}` : ""}`,
);

let hadFailures = false;
for (const [i, month] of months.entries()) {
  if (i > 0) await new Promise((r) => setTimeout(r, MONTH_THROTTLE_MS));
  const res = await backfillFrozenRuns({
    month,
    pipes,
    monitorIds,
    dryRun,
    onChunkFailure: ({ jobType, monitorIds: ids, error }) => {
      console.warn(
        `[backfill-uptime-runs] ${month} ${jobType} chunk of ${ids.length} failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    },
  });

  console.log(
    `[backfill-uptime-runs] ${month}: rows=${res.rows} ${dryRun ? "wouldUpdate" : "updated"}=${res.updated} daysFilled=${res.daysFilled} upToDate=${res.upToDate} noPopulation=${res.noPopulation.length} noData=${res.noData.length} failed=${res.failed.length} writeFailures=${res.failures.length}`,
  );
  if (res.failed.length > 0) {
    console.log(`  failed monitors (re-run them): ${res.failed.join(",")}`);
  }
  for (const failure of res.failures) console.log(`  ${failure}`);
  if (res.failed.length > 0 || res.failures.length > 0) hadFailures = true;

  if (
    res.updated === 0 &&
    res.upToDate === 0 &&
    res.failed.length === 0 &&
    res.noData.length > 0
  ) {
    console.warn(
      `[backfill-uptime-runs] ${month}: no run data for any of ${res.noData.length} monitor(s), likely past raw retention; stopping before older months`,
    );
    break;
  }
}

process.exit(hadFailures ? 1 : 0);
