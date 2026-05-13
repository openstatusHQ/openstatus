import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { Tinybird } from "@chronark/zod-bird";
import { isNotNull } from "drizzle-orm";
import { z } from "zod";

import { externalService } from "@openstatus/db/src/schema";

const env = z
  .object({
    DATABASE_URL: z.string().min(1),
    DATABASE_AUTH_TOKEN: z.string().min(1),
    TINY_BIRD_API_KEY: z.string().min(1),
    TINYBIRD_URL: z.string().optional(),
    EXTERNAL_STATUS_V0_PIPE: z.string().prefault("endpoint_external_status"),
  })
  .parse(process.env);

const v0RowSchema = z.object({
  name: z.string(),
  description: z.string(),
  indicator: z.string(),
  url: z.string(),
  fetched_at: z.coerce.number(),
  updated_at: z.coerce.number(),
  time_zone: z.string().prefault(""),
});
type V0Row = z.infer<typeof v0RowSchema>;

const v0ResponseSchema = z.object({
  data: z.array(v0RowSchema),
});

type Snapshot = {
  id: string;
  indicator: string;
  status: string;
  status_message: string;
  fetched_at: number;
  updated_at: number;
  time_zone: string;
};

function inferStatusFromIndicator(indicator: string, description: string): string {
  const lower = description.toLowerCase();
  if (lower.includes("maintenance")) return "under_maintenance";
  switch (indicator) {
    case "none":
      return "operational";
    case "minor":
      return "degraded";
    case "major":
      return "partial_outage";
    case "critical":
      return "major_outage";
    default:
      return "operational";
  }
}

async function fetchAllV0Rows(): Promise<V0Row[]> {
  const baseUrl = env.TINYBIRD_URL ?? "https://api.tinybird.co";
  const out: V0Row[] = [];
  const seenNames = new Set<string>();
  const knownNames: string[] = [];

  const listUrl = `${baseUrl}/v0/pipes/${env.EXTERNAL_STATUS_V0_PIPE}.json?limit=10000`;
  const res = await fetch(listUrl, {
    headers: { Authorization: `Bearer ${env.TINY_BIRD_API_KEY}` },
  });
  if (!res.ok) {
    throw new Error(`v0 pipe fetch failed: ${res.status} ${res.statusText}`);
  }
  const json = await res.json();
  const parsed = v0ResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error(`v0 pipe payload invalid: ${parsed.error.message}`);
  }
  for (const row of parsed.data.data) {
    out.push(row);
    if (!seenNames.has(row.name)) {
      seenNames.add(row.name);
      knownNames.push(row.name);
    }
  }
  console.log(
    `[backfill] fetched ${out.length} v0 rows covering ${knownNames.length} unique names`,
  );
  return out;
}

async function loadNameToSlugMap(): Promise<Map<string, string>> {
  const client = createClient({
    url: env.DATABASE_URL,
    authToken: env.DATABASE_AUTH_TOKEN,
  });
  const db = drizzle(client);
  const rows = await db
    .select({ name: externalService.name, slug: externalService.slug })
    .from(externalService)
    .where(isNotNull(externalService.slug))
    .all();
  const map = new Map<string, string>();
  for (const r of rows) {
    map.set(r.name, r.slug);
  }
  console.log(`[backfill] loaded ${map.size} name→slug mappings from libSQL`);
  return map;
}

function rowsToSnapshots(args: {
  rows: V0Row[];
  nameToSlug: Map<string, string>;
}): { snapshots: Snapshot[]; unmapped: Map<string, V0Row[]> } {
  const snapshots: Snapshot[] = [];
  const unmapped = new Map<string, V0Row[]>();
  for (const row of args.rows) {
    const slug = args.nameToSlug.get(row.name);
    if (!slug) {
      const bucket = unmapped.get(row.name) ?? [];
      bucket.push(row);
      unmapped.set(row.name, bucket);
      continue;
    }
    snapshots.push({
      id: slug,
      indicator: row.indicator,
      status: inferStatusFromIndicator(row.indicator, row.description),
      status_message: row.description,
      fetched_at: row.fetched_at,
      updated_at: row.updated_at,
      time_zone: row.time_zone,
    });
  }
  return { snapshots, unmapped };
}

async function publishSnapshots(snapshots: Snapshot[]): Promise<void> {
  const baseUrl = env.TINYBIRD_URL ?? "https://api.tinybird.co";
  const tb = new Tinybird({ token: env.TINY_BIRD_API_KEY, baseUrl });
  const publish = tb.buildIngestEndpoint({
    datasource: "external_status__v1",
    event: z.object({
      id: z.string(),
      indicator: z.string(),
      status: z.string(),
      status_message: z.string(),
      fetched_at: z.number(),
      updated_at: z.number(),
      time_zone: z.string(),
    }),
  });
  const chunk = 1000;
  for (let i = 0; i < snapshots.length; i += chunk) {
    const slice = snapshots.slice(i, i + chunk);
    await publish(slice);
    console.log(
      `[backfill] pushed ${Math.min(i + chunk, snapshots.length)}/${snapshots.length}`,
    );
  }
}

async function main() {
  const [rows, nameToSlug] = await Promise.all([
    fetchAllV0Rows(),
    loadNameToSlugMap(),
  ]);
  const { snapshots, unmapped } = rowsToSnapshots({ rows, nameToSlug });

  if (unmapped.size > 0) {
    const dump = {
      generated_at: new Date().toISOString(),
      count: Array.from(unmapped.values()).reduce((s, b) => s + b.length, 0),
      names: Array.from(unmapped.keys()),
      sample_rows: Array.from(unmapped.values())
        .flatMap((b) => b.slice(0, 3))
        .slice(0, 30),
    };
    const target = join(process.cwd(), "unmapped.json");
    writeFileSync(target, JSON.stringify(dump, null, 2));
    console.warn(
      `[backfill] ${unmapped.size} unmapped name(s) — wrote ${target}`,
    );
  } else {
    console.log("[backfill] no unmapped rows");
  }

  if (snapshots.length === 0) {
    console.log("[backfill] no snapshots to publish; exiting");
    return;
  }

  await publishSnapshots(snapshots);
  console.log(
    `[backfill] complete: published ${snapshots.length} snapshots (${unmapped.size} unmapped names)`,
  );
}

main().catch((err) => {
  console.error("[backfill] failed:", err);
  process.exit(1);
});
