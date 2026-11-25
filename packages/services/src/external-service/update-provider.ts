import { and, db as defaultDb, eq } from "@openstatus/db";
import {
  type ApiConfig,
  type StatusPageProvider,
  externalService,
} from "@openstatus/db/src/schema";

import { withBusyRetry } from "../retry";
import { type GlobalReadContext, liveOnlyClause } from "./internal";

export type ApplyDetectedProviderInput = {
  serviceId: number;
  expected: { provider: StatusPageProvider; apiConfig: ApiConfig | null };
  set: { provider: StatusPageProvider; apiConfig: ApiConfig | null };
};

function apiConfigEquals(a: ApiConfig | null, b: ApiConfig | null): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

// No `withTransaction`/`emitAudit`: external services are a global, public,
// cron-driven catalogue with no workspace scope or audit log (ADR-0006/0007);
// the deduped Sentry event emitted by the caller is the change trail.
export async function applyDetectedProvider(args: {
  ctx?: GlobalReadContext;
  input: ApplyDetectedProviderInput;
  now?: Date;
}): Promise<{ updated: boolean }> {
  const { ctx, input } = args;
  const db = ctx?.db ?? defaultDb;
  const now = args.now ?? new Date();

  return withBusyRetry(() =>
    db.transaction(async (tx) => {
      const rows = await tx
        .select({
          provider: externalService.provider,
          apiConfig: externalService.apiConfig,
        })
        .from(externalService)
        .where(and(eq(externalService.id, input.serviceId), liveOnlyClause()))
        .all();

      const row = rows[0];
      if (
        !row ||
        row.provider !== input.expected.provider ||
        !apiConfigEquals(row.apiConfig ?? null, input.expected.apiConfig)
      ) {
        return { updated: false };
      }

      await tx
        .update(externalService)
        .set({
          provider: input.set.provider,
          apiConfig: input.set.apiConfig,
          updatedAt: now,
        })
        .where(eq(externalService.id, input.serviceId))
        .run();

      return { updated: true };
    }),
  );
}
