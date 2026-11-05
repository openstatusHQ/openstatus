// One-off: moves the `[From Slack](url)` suffix of notes written before
// `incident_event.source` existed into `source` / `source_ref`.
// deno run -A --env-file --sloppy-imports scripts/backfill-incident-event-source.mts [--apply]
import { createClient } from "@libsql/client";
import { and, eq, isNull, like } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";

import { env } from "../env.mjs";
import { incidentEvent } from "../src/schema";

const FROM_SLACK = /\n\n\[From Slack\]\((https?:\/\/\S+)\)$/;
const apply = process.argv.includes("--apply");

const db = drizzle(
  createClient({ url: env.DATABASE_URL, authToken: env.DATABASE_AUTH_TOKEN }),
);

const rows = await db
  .select({ id: incidentEvent.id, message: incidentEvent.message })
  .from(incidentEvent)
  .where(
    and(
      eq(incidentEvent.type, "note"),
      isNull(incidentEvent.source),
      like(incidentEvent.message, "%[From Slack](%"),
    ),
  )
  .all();

let updated = 0;
for (const row of rows) {
  const match = row.message ? FROM_SLACK.exec(row.message) : null;
  if (!row.message || !match) continue;
  updated++;
  if (!apply) continue;
  await db
    .update(incidentEvent)
    .set({
      source: "slack",
      sourceRef: match[1],
      message: row.message.replace(FROM_SLACK, ""),
    })
    .where(eq(incidentEvent.id, row.id));
}

console.log(
  `${apply ? "Backfilled" : "Would backfill"} ${updated} of ${rows.length} candidate notes`,
);
process.exit(0);
