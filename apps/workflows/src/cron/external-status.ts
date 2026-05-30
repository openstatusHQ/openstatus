import { getLogger } from "@logtape/logtape";
import { listExternalServices } from "@openstatus/services/external-service";
import type { ExternalServiceRow } from "@openstatus/services/external-service";
import {
  type UpsertExternalIncidentInput,
  upsertExternalIncidentsForService,
} from "@openstatus/services/external-service-incident";
import { FetchError, fetchers } from "@openstatus/status-fetcher";
import type {
  NormalizedIncident,
  StatusFetcher,
  StatusPageEntry,
  StatusResult,
} from "@openstatus/status-fetcher";
import { OSTinybird } from "@openstatus/tinybird";
import { Effect } from "effect";
import type { Context } from "hono";

import { env } from "../env";
import { db } from "@openstatus/db";
import { reportBackgroundError, runSentryCron } from "../lib/sentry";

const logger = getLogger(["workflow", "external-status"]);

const tb = new OSTinybird(env().TINY_BIRD_API_KEY);

// 10 per phase × 2 phases = peak 20 concurrent HTTP requests upstream; keeps
// Atlassian/Incident.io CDNs comfortable while still parallelising heavily.
const PHASE_CONCURRENCY = 10;

function toStatusPageEntry(row: ExternalServiceRow): StatusPageEntry {
  return {
    id: row.slug,
    name: row.name,
    url: row.url,
    status_page_url: row.statusPageUrl,
    provider: row.provider,
    industry: row.industry,
    description: row.description ?? undefined,
    api_config: row.apiConfig ?? undefined,
  };
}

type Snapshot = {
  id: string;
  indicator: string;
  status: string;
  status_message: string;
  fetched_at: number;
  updated_at: number;
  time_zone: string;
};

function buildSnapshot(args: {
  entry: StatusPageEntry;
  result: StatusResult;
  fetchedAt: number;
}): Snapshot {
  const { entry, result, fetchedAt } = args;
  return {
    id: entry.id,
    indicator: result.severity,
    status: result.status,
    status_message: result.description,
    fetched_at: fetchedAt,
    updated_at: result.updated_at,
    time_zone: result.timezone ?? "",
  };
}

function toUpsertInput(
  incident: NormalizedIncident,
): UpsertExternalIncidentInput {
  return {
    providerIncidentId: incident.providerIncidentId,
    name: incident.name,
    status: incident.status,
    impact: incident.impact,
    shortlink: incident.shortlink,
    startedAt: incident.startedAt,
    createdAt: incident.createdAt,
    resolvedAt: incident.resolvedAt,
    raw: incident.raw,
  };
}

type PhaseCounts = {
  successCount: number;
  failureCount: number;
  skippedCount: number;
  total: number;
};

type StatusPhaseOutcome =
  | { kind: "ok"; snapshot: Snapshot }
  | { kind: "no-fetcher"; slug: string }
  | { kind: "fail"; slug: string; reason: string };

type IncidentPhaseOutcome =
  | { kind: "ok"; slug: string; count: number }
  | { kind: "skip"; slug: string }
  | { kind: "fail"; slug: string; reason: string };

type Triplet = {
  row: ExternalServiceRow;
  entry: StatusPageEntry;
  fetcher: StatusFetcher | null;
};

function runStatusPhase(
  triplets: Triplet[],
  fetchedAt: number,
): Effect.Effect<StatusPhaseOutcome[]> {
  return Effect.forEach(
    triplets,
    ({ entry, fetcher }) => {
      if (!fetcher) {
        return Effect.succeed<StatusPhaseOutcome>({
          kind: "no-fetcher",
          slug: entry.id,
        });
      }
      return fetcher.fetch(entry).pipe(
        Effect.map(
          (result): StatusPhaseOutcome => ({
            kind: "ok",
            snapshot: buildSnapshot({ entry, result, fetchedAt }),
          }),
        ),
        Effect.catchAll((err: FetchError) =>
          Effect.succeed<StatusPhaseOutcome>({
            kind: "fail",
            slug: entry.id,
            reason: err.message,
          }),
        ),
      );
    },
    { concurrency: PHASE_CONCURRENCY },
  );
}

function runIncidentPhase(
  triplets: Triplet[],
  tickStartedAt: Date,
): Effect.Effect<IncidentPhaseOutcome[]> {
  return Effect.forEach(
    triplets,
    ({ row, entry, fetcher }) => {
      if (!fetcher || !fetcher.fetchIncidents) {
        return Effect.succeed<IncidentPhaseOutcome>({
          kind: "skip",
          slug: entry.id,
        });
      }
      return fetcher.fetchIncidents(entry).pipe(
        Effect.flatMap((incidents) =>
          Effect.tryPromise({
            try: () =>
              upsertExternalIncidentsForService({
                ctx: { db },
                externalServiceId: row.id,
                incidents: incidents.map(toUpsertInput),
                now: tickStartedAt,
              }),
            catch: (e) =>
              new FetchError({
                url: entry.status_page_url,
                fetcherName: fetcher.name,
                entryId: entry.id,
                cause: e instanceof Error ? e : new Error(String(e)),
              }),
          }).pipe(
            Effect.map(
              (result): IncidentPhaseOutcome => ({
                kind: "ok",
                slug: entry.id,
                count: result.upserted,
              }),
            ),
          ),
        ),
        Effect.catchAll((err: FetchError) =>
          Effect.succeed<IncidentPhaseOutcome>({
            kind: "fail",
            slug: entry.id,
            reason: err.message,
          }),
        ),
      );
    },
    { concurrency: PHASE_CONCURRENCY },
  );
}

function summarizeStatus(outcomes: StatusPhaseOutcome[]): {
  counts: PhaseCounts;
  snapshots: Snapshot[];
} {
  const snapshots: Snapshot[] = [];
  let successCount = 0;
  let failureCount = 0;
  let skippedCount = 0;
  for (const o of outcomes) {
    if (o.kind === "ok") {
      snapshots.push(o.snapshot);
      successCount++;
    } else if (o.kind === "no-fetcher") {
      skippedCount++;
      logger.warn("external-status status: no fetcher matches slug={slug}", {
        slug: o.slug,
      });
    } else {
      failureCount++;
      logger.warn(
        "external-status status: fetch failed for slug={slug}: {reason}",
        { slug: o.slug, reason: o.reason },
      );
    }
  }
  return {
    counts: {
      successCount,
      failureCount,
      skippedCount,
      total: outcomes.length,
    },
    snapshots,
  };
}

function summarizeIncidents(outcomes: IncidentPhaseOutcome[]): PhaseCounts {
  let successCount = 0;
  let failureCount = 0;
  let skippedCount = 0;
  for (const o of outcomes) {
    if (o.kind === "ok") {
      successCount++;
    } else if (o.kind === "skip") {
      skippedCount++;
    } else {
      failureCount++;
      logger.warn(
        "external-status incidents: failed for slug={slug}: {reason}",
        { slug: o.slug, reason: o.reason },
      );
    }
  }
  return {
    successCount,
    failureCount,
    skippedCount,
    total: outcomes.length,
  };
}

function buildTriplets(services: ExternalServiceRow[]): Triplet[] {
  return services.map((row) => {
    const entry = toStatusPageEntry(row);
    const fetcher = fetchers.find((f) => f.canHandle(entry)) ?? null;
    return { row, entry, fetcher };
  });
}

export async function runExternalStatusTick(): Promise<{
  status: PhaseCounts;
  incidents: PhaseCounts;
}> {
  const services = await listExternalServices({ ctx: { db } });

  const triplets = buildTriplets(services);
  const tickStartedAt = new Date();

  const [statusOutcomes, incidentOutcomes] = await Effect.runPromise(
    Effect.all(
      [
        runStatusPhase(triplets, tickStartedAt.getTime()),
        runIncidentPhase(triplets, tickStartedAt),
      ],
      { concurrency: "unbounded" },
    ),
  );

  const status = summarizeStatus(statusOutcomes);
  const incidents = summarizeIncidents(incidentOutcomes);

  if (status.snapshots.length > 0) {
    await tb.publishExternalStatus(status.snapshots);
  }

  return { status: status.counts, incidents };
}

export async function handleExternalStatusCron(c: Context) {
  const { cronCompleted, cronFailed } = runSentryCron("external-status");

  // Background chain: must not capture `c` or anything derived from it
  // (e.g. via getSentry(c)). The handler returns 200 before this resolves, and
  // a captured per-request Sentry hub stays pinned across retries — see
  // apps/workflows/plan.md.
  void Effect.runPromise(
    Effect.tryPromise({
      try: () => runExternalStatusTick(),
      catch: (e) =>
        new Error(
          `external-status tick failed: ${e instanceof Error ? e.message : String(e)}`,
        ),
    }).pipe(
      Effect.tap((res) =>
        Effect.sync(() => {
          logger.info(
            "external-status tick complete: status={statusOk}/{statusTotal} ({statusFail} failures, {statusSkip} skipped), incidents={incOk}/{incTotal} ({incFail} failures, {incSkip} skipped)",
            {
              statusOk: res.status.successCount,
              statusTotal: res.status.total,
              statusFail: res.status.failureCount,
              statusSkip: res.status.skippedCount,
              incOk: res.incidents.successCount,
              incTotal: res.incidents.total,
              incFail: res.incidents.failureCount,
              incSkip: res.incidents.skippedCount,
            },
          );
          void cronCompleted();
        }),
      ),
      Effect.catchAll((e) =>
        Effect.sync(() => {
          logger.error("external-status tick errored: {message}", {
            message: e.message,
          });
          void reportBackgroundError(e.message);
          void cronFailed();
        }),
      ),
    ),
  );

  return c.json({ success: true }, 200);
}
