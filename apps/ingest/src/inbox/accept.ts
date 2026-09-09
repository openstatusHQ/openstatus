import { getAlertAdapter } from "@openstatus/alert-adapters";
import type { AlertInbox, ServiceContext } from "@openstatus/services";
import { recordInboxEvent } from "@openstatus/services/alert-inbox";
import { findOrCreateAlertSource } from "@openstatus/services/alert-source";
import { Effect, Exit } from "effect";

import { env } from "../env";
import {
  AuthError,
  DbError,
  PayloadTooLargeError,
  RateLimitedError,
  errorMessage,
} from "../errors";
import { authenticate } from "../lib/auth";
import { dedupKeyFor, fingerprintFor } from "../lib/dedup";
import { rateLimit } from "../lib/rate-limit";

export type AcceptResult = {
  accepted: boolean;
  duplicate: boolean;
  row: AlertInbox | null;
};

type DerivedKeys = {
  externalId: string | null;
  fingerprint: string | null;
  statusKey: string;
  invalid: boolean;
};

const readBoundedBody = Effect.fn("readBoundedBody")(function* (req: Request) {
  const limit = env.MAX_BODY_BYTES;
  const declared = req.headers.get("content-length");
  if (declared && Number(declared) > limit) {
    return yield* new PayloadTooLargeError({ limitBytes: limit });
  }
  const raw = yield* Effect.tryPromise({
    try: () => req.text(),
    catch: (cause) =>
      new DbError({ cause: errorMessage(cause), retryable: false }),
  });
  if (new TextEncoder().encode(raw).length > limit) {
    return yield* new PayloadTooLargeError({ limitBytes: limit });
  }
  return raw;
});

/**
 * Best effort by design: a payload the adapter cannot read still gets stored, it
 * just loses its ordering key. Losing the key is a degraded mode; dropping the
 * payload would be data loss.
 */
async function deriveKeys(
  provider: string,
  alertSourceId: number,
  raw: string,
): Promise<DerivedKeys> {
  const adapter = getAlertAdapter(provider);
  if (!adapter) {
    return {
      externalId: null,
      fingerprint: null,
      statusKey: "",
      invalid: true,
    };
  }

  const exit = await Effect.runPromiseExit(
    Effect.sync(() => {
      const body = adapter.parseBody(raw, "application/json");
      const groupKey = adapter.groupKey(body);
      const alerts = adapter.formatAlerts(body);
      const statuses = [...new Set(alerts.map((a) => a.status))].sort();
      return {
        groupKey,
        externalId: alerts.length === 1 ? (alerts[0].externalId ?? null) : null,
        statusKey: statuses.join("+"),
      };
    }),
  );

  if (Exit.isFailure(exit)) {
    return {
      externalId: null,
      fingerprint: null,
      statusKey: "",
      invalid: true,
    };
  }

  const fingerprint = exit.value.groupKey
    ? await fingerprintFor(alertSourceId, exit.value.groupKey)
    : null;

  return {
    externalId: exit.value.externalId,
    fingerprint,
    statusKey: exit.value.statusKey,
    invalid: false,
  };
}

export const acceptWebhook = Effect.fn("acceptWebhook")(function* (
  req: Request,
  provider: string,
) {
  const adapter = getAlertAdapter(provider);
  if (!adapter) {
    return yield* new AuthError({ reason: `unknown provider "${provider}"` });
  }

  const auth = yield* authenticate(req);

  const ctx: ServiceContext = {
    workspace: auth.workspace,
    actor: {
      type: "apiKey",
      keyId: auth.keyId,
      scopes: auth.scopes,
    },
  };

  const verdict = yield* Effect.promise(() =>
    rateLimit({
      key: `${auth.workspace.id}:${provider}`,
      limit: env.RATE_LIMIT_PER_MINUTE,
      windowSeconds: 60,
    }),
  );
  if (!verdict.allowed) {
    return yield* new RateLimitedError({ retryAfterSeconds: 60 });
  }

  const source = yield* Effect.tryPromise({
    try: () =>
      findOrCreateAlertSource({
        ctx,
        input: { provider: adapter.id as "alertmanager" | "grafana" },
      }),
    catch: (cause) =>
      new DbError({ cause: errorMessage(cause), retryable: false }),
  });

  const raw = yield* readBoundedBody(req);

  // Nothing is dropped: an over-limit or deactivated source still stores the
  // payload, settled `ignored`, so raising the plan processes what was kept.
  const settleAs: "ignored" | "invalid" | null =
    source.overLimit || !source.source.active ? "ignored" : null;
  const settleReason = source.overLimit
    ? "workspace is over its alert-sources limit"
    : source.source.active
      ? null
      : "alert source is deactivated";

  const sourceId = source.source.id;
  const keys = yield* Effect.promise(() =>
    deriveKeys(adapter.id, sourceId, raw),
  );
  const dedupKey = yield* Effect.promise(() =>
    dedupKeyFor({
      alertSourceId: sourceId,
      externalId: keys.externalId,
      fingerprint: keys.fingerprint,
      statusKey: keys.statusKey,
      rawBody: raw,
    }),
  );

  const row = yield* Effect.tryPromise({
    try: () =>
      recordInboxEvent({
        ctx,
        input: {
          alertSourceId: sourceId,
          dedupKey,
          rawBody: raw,
          contentType: req.headers.get("content-type"),
          externalId: keys.externalId,
          fingerprint: keys.fingerprint,
          settleAs: keys.invalid ? "invalid" : settleAs,
          settleReason: keys.invalid
            ? "adapter could not parse the payload"
            : settleReason,
        },
      }),
    catch: (cause) =>
      new DbError({ cause: errorMessage(cause), retryable: true }),
  });

  return {
    accepted: true,
    duplicate: row === null,
    row,
  } satisfies AcceptResult;
}, Effect.withSpan("ingest.accept"));
