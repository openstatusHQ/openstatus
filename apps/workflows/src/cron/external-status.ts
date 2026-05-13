import { getSentry } from "@hono/sentry";
import { getLogger } from "@logtape/logtape";
import { listExternalServices } from "@openstatus/services/external-service";
import type { ExternalServiceRow } from "@openstatus/services/external-service";
import { fetchers } from "@openstatus/status-fetcher";
import type { StatusPageEntry, StatusResult } from "@openstatus/status-fetcher";
import { OSTinybird } from "@openstatus/tinybird";
import { Effect, Schedule } from "effect";
import type { Context } from "hono";

import { env } from "../env";
import { db } from "../lib/db";

const logger = getLogger(["workflow", "external-status"]);

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

export async function runExternalStatusTick(): Promise<{
  successCount: number;
  failureCount: number;
  total: number;
}> {
  const tb = new OSTinybird(env().TINY_BIRD_API_KEY);
  const services = await listExternalServices({ ctx: { db } });

  const entries = services.map(toStatusPageEntry);
  const fetchedAt = Date.now();

  const settled = await Promise.allSettled(
    entries.map(async (entry) => {
      const fetcher = fetchers.find((f) => f.canHandle(entry));
      if (!fetcher) {
        throw new Error(`no fetcher matches entry slug=${entry.id}`);
      }
      const result = await fetcher.fetch(entry);
      return buildSnapshot({ entry, result, fetchedAt });
    }),
  );

  const snapshots: Snapshot[] = [];
  let failureCount = 0;
  for (const [i, r] of settled.entries()) {
    if (r.status === "fulfilled") {
      snapshots.push(r.value);
    } else {
      failureCount++;
      const slug = entries[i]?.id ?? "<unknown>";
      logger.warn(
        "external-status tick: fetcher failed for slug={slug}: {reason}",
        {
          slug,
          reason:
            r.reason instanceof Error ? r.reason.message : String(r.reason),
        },
      );
    }
  }

  if (snapshots.length > 0) {
    await tb.publishExternalStatus(snapshots);
  }

  return {
    successCount: snapshots.length,
    failureCount,
    total: entries.length,
  };
}

export async function handleExternalStatusCron(c: Context) {
  const sentry = getSentry(c);
  const checkInId = sentry.captureCheckIn({
    monitorSlug: "external-status",
    status: "in_progress",
  });

  void Effect.runPromise(
    Effect.tryPromise({
      try: () => runExternalStatusTick(),
      catch: (e) =>
        new Error(
          `external-status tick failed: ${e instanceof Error ? e.message : String(e)}`,
        ),
    }).pipe(
      Effect.retry({
        times: 3,
        schedule: Schedule.exponential("1000 millis"),
      }),
      Effect.tap((res) =>
        Effect.sync(() => {
          logger.info(
            "external-status tick complete: {success}/{total} ({failures} failures)",
            {
              success: res.successCount,
              total: res.total,
              failures: res.failureCount,
            },
          );
          sentry.captureCheckIn({
            checkInId,
            monitorSlug: "external-status",
            status: "ok",
          });
        }),
      ),
      Effect.catchAll((e) =>
        Effect.sync(() => {
          logger.error("external-status tick errored: {message}", {
            message: e.message,
          });
          sentry.captureMessage(e.message, "error");
          sentry.captureCheckIn({
            checkInId,
            monitorSlug: "external-status",
            status: "error",
          });
        }),
      ),
    ),
  );

  return c.json({ success: true }, 200);
}
