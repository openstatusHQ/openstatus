import { getLogger } from "@logtape/logtape";
import { getAlertAdapter } from "@openstatus/alert-adapters";
import { db, eq } from "@openstatus/db";
import {
  alertSource,
  selectWorkspaceSchema,
  workspace,
} from "@openstatus/db/src/schema";
import type {
  AlertInbox,
  ServiceContext,
  Workspace,
} from "@openstatus/services";
import {
  isRetryableDbError,
  isTransientServerError,
} from "@openstatus/services";
import {
  claimInboxRows,
  deadLetterInboxRow,
  releaseInboxClaims,
  retryInboxRow,
  settleInboxRow,
} from "@openstatus/services/alert-inbox";
import {
  resolveIncidentByFingerprint,
  upsertIncidentByFingerprint,
} from "@openstatus/services/incident";
import { Cause, Effect, Exit, Option } from "effect";

import { AdapterError, DbError, WorkspaceError, errorMessage } from "../errors";

const logger = getLogger(["ingest"]);

const CLAIM_LIMIT = 20;
const PROCESS_CONCURRENCY = 5;
const PROCESS_TIMEOUT_MS = 10_000;
const MAX_BACKOFF_MS = 30_000;
const LEASE_SLACK_MS = 5_000;

export const workerId = crypto.randomUUID();

const inFlight = new Set<number>();

export type DrainSummary = {
  claimed: number;
  processed: number;
  ignored: number;
  retried: number;
  dead: number;
};

function leaseSeconds(limit: number, timeoutMs: number): number {
  const waves = Math.ceil(limit / PROCESS_CONCURRENCY);
  return Math.ceil((waves * timeoutMs + LEASE_SLACK_MS) / 1000);
}

function backoffMs(attempt: number): number {
  const ceiling = Math.min(1000 * 2 ** attempt, MAX_BACKOFF_MS);
  return ceiling / 2 + Math.random() * (ceiling / 2);
}

async function loadContext(row: AlertInbox): Promise<ServiceContext> {
  const source = await db
    .select()
    .from(alertSource)
    .where(eq(alertSource.id, row.alertSourceId))
    .get();
  if (!source) throw new Error(`alert source ${row.alertSourceId} is gone`);

  const workspaceRow = await db
    .select()
    .from(workspace)
    .where(eq(workspace.id, source.workspaceId))
    .get();
  if (!workspaceRow) throw new Error(`workspace ${source.workspaceId} is gone`);

  const parsed = selectWorkspaceSchema.parse(workspaceRow) satisfies Workspace;

  return {
    workspace: parsed,
    // Scope was enforced against the API key at accept time; re-checking a
    // possibly-rotated key during async drain would check the wrong thing.
    actor: {
      type: "webhook",
      source: source.provider,
      externalId: row.externalId ?? undefined,
    },
  };
}

const processRow = Effect.fn("processRow")(function* (row: AlertInbox) {
  const ctx = yield* Effect.tryPromise({
    try: () => loadContext(row),
    catch: (cause) => new WorkspaceError({ reason: errorMessage(cause) }),
  });

  const source = yield* Effect.tryPromise({
    try: () =>
      db
        .select()
        .from(alertSource)
        .where(eq(alertSource.id, row.alertSourceId))
        .get(),
    catch: (cause) =>
      new DbError({ cause: errorMessage(cause), retryable: true }),
  });
  if (!source) {
    return yield* new WorkspaceError({ reason: "alert source is gone" });
  }

  const adapter = getAlertAdapter(source.provider);
  if (!adapter) {
    return yield* new AdapterError({
      adapterId: source.provider,
      cause: "no adapter registered",
    });
  }

  const alerts = yield* Effect.try({
    try: () =>
      adapter.formatAlerts(adapter.parseBody(row.rawBody, row.contentType)),
    catch: (cause) =>
      new AdapterError({ adapterId: adapter.id, cause: errorMessage(cause) }),
  });

  if (row.fingerprint === null) {
    return yield* new AdapterError({
      adapterId: adapter.id,
      cause: "payload carried no group identity",
    });
  }

  const fingerprint = row.fingerprint;
  let incidentId: number | null = null;

  for (const alert of alerts) {
    if (alert.status === "resolved") {
      const resolved = yield* Effect.tryPromise({
        try: () =>
          resolveIncidentByFingerprint({
            ctx,
            input: { alertSourceId: row.alertSourceId, fingerprint },
          }),
        catch: (cause) => toDbError(cause),
      });
      if (resolved) incidentId = resolved.id;
      continue;
    }

    const { incident } = yield* Effect.tryPromise({
      try: () =>
        upsertIncidentByFingerprint({
          ctx,
          input: {
            alertSourceId: row.alertSourceId,
            fingerprint,
            title: alert.title,
            summary: alert.description ?? "",
            severity: alert.severity,
            startedAt: alert.startsAt,
          },
        }),
      catch: (cause) => toDbError(cause),
    });
    incidentId = incident.id;
  }

  return incidentId;
});

function toDbError(cause: unknown): DbError {
  return new DbError({
    cause: errorMessage(cause),
    retryable: isRetryableDbError(cause) || isTransientServerError(cause),
  });
}

async function handleRow(row: AlertInbox): Promise<DrainSummary> {
  const summary: DrainSummary = {
    claimed: 0,
    processed: 0,
    ignored: 0,
    retried: 0,
    dead: 0,
  };

  inFlight.add(row.id);
  try {
    const exit = await Effect.runPromiseExit(
      processRow(row).pipe(Effect.timeout(PROCESS_TIMEOUT_MS)),
    );

    if (Exit.isSuccess(exit)) {
      await settleInboxRow({
        id: row.id,
        outcome: "processed",
        incidentId: exit.value,
      });
      summary.processed = 1;
      return summary;
    }

    const error = Option.getOrNull(Cause.findErrorOption(exit.cause));
    const message = describe(error, exit.cause);

    // Parsing is deterministic: retrying a payload the adapter cannot read only
    // burns the deadline. Only genuine transient DB failures get another go.
    if (error !== null && isIgnorable(error)) {
      await settleInboxRow({ id: row.id, outcome: "ignored", error: message });
      summary.ignored = 1;
      return summary;
    }

    if (!isRetryable(error)) {
      await deadLetterInboxRow({ row, error: message });
      summary.dead = 1;
      return summary;
    }

    const now = Math.floor(Date.now() / 1000);
    const delay = Math.ceil(backoffMs(row.attempts) / 1000);
    if (now + delay >= row.deadlineAt) {
      await deadLetterInboxRow({ row, error: `deadline exceeded: ${message}` });
      summary.dead = 1;
      return summary;
    }

    await retryInboxRow({
      id: row.id,
      nextAttemptAt: now + delay,
      error: message,
    });
    summary.retried = 1;
    return summary;
  } finally {
    inFlight.delete(row.id);
  }
}

type TaggedFailure = { readonly _tag: string };

/** A timeout carries no typed error of ours; both it and transient DB faults retry. */
function isRetryable(error: TaggedFailure | null): boolean {
  if (error === null) return true;
  if (error._tag === "TimeoutError") return true;
  return (
    error._tag === "DbError" && "retryable" in error && error.retryable === true
  );
}

function isIgnorable(error: TaggedFailure): boolean {
  return error._tag === "PlanLimitError" || error._tag === "WorkspaceError";
}

function describe(
  error: TaggedFailure | null,
  cause: Cause.Cause<unknown>,
): string {
  if (error === null) return errorMessage(Cause.squash(cause));
  const detail =
    "cause" in error && typeof error.cause === "string"
      ? error.cause
      : "reason" in error && typeof error.reason === "string"
        ? error.reason
        : "";
  return detail ? `${error._tag}: ${detail}` : error._tag;
}

export async function drainOnce(
  opts: { alertSourceIds?: number[] } = {},
): Promise<DrainSummary> {
  const lease = leaseSeconds(CLAIM_LIMIT, PROCESS_TIMEOUT_MS);
  const rows = await claimInboxRows({
    workerId,
    limit: CLAIM_LIMIT,
    leaseSeconds: lease,
    alertSourceIds: opts.alertSourceIds,
  });

  const total: DrainSummary = {
    claimed: rows.length,
    processed: 0,
    ignored: 0,
    retried: 0,
    dead: 0,
  };
  if (rows.length === 0) return total;

  for (let i = 0; i < rows.length; i += PROCESS_CONCURRENCY) {
    const wave = rows.slice(i, i + PROCESS_CONCURRENCY);
    const results = await Promise.all(wave.map((row) => handleRow(row)));
    for (const r of results) {
      total.processed += r.processed;
      total.ignored += r.ignored;
      total.retried += r.retried;
      total.dead += r.dead;
    }
  }

  logger.info("inbox drained", { ...total });
  return total;
}

/** Hands back rows this worker claimed but never started sending. */
export async function releaseClaims(): Promise<number> {
  return releaseInboxClaims({ workerId, exceptIds: [...inFlight] });
}
