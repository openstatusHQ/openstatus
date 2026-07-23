import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { Tinybird } from "@chronark/zod-bird";
import { createClient } from "@libsql/client";
import { externalService } from "@openstatus/db/src/schema";
import { isNotNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { z } from "zod";

const env = z
  .object({
    DATABASE_URL: z.string().min(1),
    DATABASE_AUTH_TOKEN: z.string().prefault(""),
    TINY_BIRD_API_KEY: z.string().min(1),
    TINYBIRD_URL: z.string().optional(),
    V0_DATASOURCE: z.string().prefault("external_status"),
    V1_DATASOURCE: z.string().prefault("external_status__v1"),
    PAGE_SIZE: z.coerce.number().int().positive().prefault(10000),
    FORCE: z
      .string()
      .optional()
      .transform((v) => v === "1" || v === "true"),
  })
  .parse(process.env);

const SAFETY_WINDOW_MS = 60 * 60 * 1000; // 1 hour

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

const v0SqlResponseSchema = z.object({
  data: z.array(v0RowSchema),
  rows: z.number(),
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

function inferStatusFromIndicator(
  indicator: string,
  description: string,
): string {
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

  let offset = 0;
  while (true) {
    const sql = `SELECT description, fetched_at, indicator, name, time_zone, updated_at, url FROM ${env.V0_DATASOURCE} ORDER BY fetched_at LIMIT ${env.PAGE_SIZE} OFFSET ${offset} FORMAT JSON`;
    const url = `${baseUrl}/v0/sql?q=${encodeURIComponent(sql)}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${env.TINY_BIRD_API_KEY}` },
    });
    if (!res.ok) {
      throw new Error(
        `v0 SQL fetch failed at offset=${offset}: ${res.status} ${res.statusText}`,
      );
    }
    const json = await res.json();
    const parsed = v0SqlResponseSchema.safeParse(json);
    if (!parsed.success) {
      throw new Error(`v0 SQL payload invalid: ${parsed.error.message}`);
    }
    for (const row of parsed.data.data) {
      out.push(row);
      seenNames.add(row.name);
    }
    if (parsed.data.rows < env.PAGE_SIZE) break;
    offset += env.PAGE_SIZE;
    console.log(`[backfill] paged ${out.length} rows so far...`);
  }

  console.log(
    `[backfill] fetched ${out.length} v0 rows covering ${seenNames.size} unique names`,
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

async function assertV1Empty(): Promise<void> {
  const baseUrl = env.TINYBIRD_URL ?? "https://api.tinybird.co";
  const cutoffMs = Date.now() - SAFETY_WINDOW_MS;
  const sql = `SELECT count() AS n FROM ${env.V1_DATASOURCE} WHERE fetched_at < ${cutoffMs} FORMAT JSON`;
  const url = `${baseUrl}/v0/sql?q=${encodeURIComponent(sql)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${env.TINY_BIRD_API_KEY}` },
  });
  if (!res.ok) {
    throw new Error(`v1 safety check failed: ${res.status} ${res.statusText}`);
  }
  const json = (await res.json()) as { data?: Array<{ n: number }> };
  const existing = json.data?.[0]?.n ?? 0;
  if (existing === 0) return;
  if (env.FORCE) {
    console.warn(
      `[backfill] FORCE=1 set, proceeding despite ${existing} existing rows older than 1h in ${env.V1_DATASOURCE}`,
    );
    return;
  }
  console.error(
    `[backfill] aborting: ${env.V1_DATASOURCE} has ${existing} rows older than 1h — backfill appears already done.\nRe-running would duplicate rows.\nIf you really want to re-publish, set FORCE=1 and pre-truncate ${env.V1_DATASOURCE} OR accept duplicates.`,
  );
  process.exit(2);
}

async function main() {
  await assertV1Empty();
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
