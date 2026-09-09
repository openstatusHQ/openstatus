import { db, eq } from "@openstatus/db";
import {
  alertDeadLetter,
  alertInbox,
  alertSource,
  apiKey,
  incidentTable,
} from "@openstatus/db/src/schema";
import type { Scope } from "@openstatus/db/src/schema";
import { createTestWorkspace } from "@openstatus/db/src/test/factories";
import { generateApiKey } from "@openstatus/db/src/utils/api-key";

export type IngestFixture = {
  workspaceId: number;
  userId: number;
  token: string;
  apiKeyId: number;
};

export async function createIngestFixture(
  scopes: Scope[] = ["write"],
  plan: "team" | "free" = "team",
): Promise<IngestFixture> {
  const { workspace, user } = await createTestWorkspace({ plan });
  const { token, prefix, hash } = await generateApiKey();
  const key = await db
    .insert(apiKey)
    .values({
      name: "ingest-test",
      prefix,
      hashedToken: hash,
      workspaceId: workspace.id,
      createdById: user.id,
      scopes,
    })
    .returning()
    .get();

  return {
    workspaceId: workspace.id,
    userId: user.id,
    token,
    apiKeyId: key.id,
  };
}

export async function cleanupIngestFixture(f: IngestFixture): Promise<void> {
  const sources = await db
    .select({ id: alertSource.id })
    .from(alertSource)
    .where(eq(alertSource.workspaceId, f.workspaceId))
    .all();

  for (const s of sources) {
    await db
      .delete(alertDeadLetter)
      .where(eq(alertDeadLetter.alertSourceId, s.id));
    await db.delete(alertInbox).where(eq(alertInbox.alertSourceId, s.id));
  }
  await db
    .delete(incidentTable)
    .where(eq(incidentTable.workspaceId, f.workspaceId));
  await db
    .delete(alertSource)
    .where(eq(alertSource.workspaceId, f.workspaceId));
  await db.delete(apiKey).where(eq(apiKey.id, f.apiKeyId));
}

/**
 * One `drainOnce` is not "everything is processed": a row left leased by an
 * earlier pass is legitimately skipped. Drain until nothing is claimable, which
 * is what the running drainer converges to anyway.
 */
export async function drainUntilIdle(
  drain: (opts: { alertSourceIds?: number[] }) => Promise<{ claimed: number }>,
  alertSourceIds: number[],
  maxPasses = 5,
): Promise<void> {
  for (let pass = 0; pass < maxPasses; pass++) {
    const summary = await drain({ alertSourceIds });
    if (summary.claimed === 0) return;
  }
}

export async function sourceIdsFor(workspaceId: number): Promise<number[]> {
  const rows = await db
    .select({ id: alertSource.id })
    .from(alertSource)
    .where(eq(alertSource.workspaceId, workspaceId))
    .all();
  return rows.map((r) => r.id);
}

export async function inboxRowsFor(workspaceId: number) {
  const sources = await db
    .select({ id: alertSource.id })
    .from(alertSource)
    .where(eq(alertSource.workspaceId, workspaceId))
    .all();
  if (sources.length === 0) return [];
  const rows = [];
  for (const s of sources) {
    rows.push(
      ...(await db
        .select()
        .from(alertInbox)
        .where(eq(alertInbox.alertSourceId, s.id))
        .all()),
    );
  }
  return rows;
}

export async function deadLettersFor(workspaceId: number) {
  const sources = await db
    .select({ id: alertSource.id })
    .from(alertSource)
    .where(eq(alertSource.workspaceId, workspaceId))
    .all();
  const rows = [];
  for (const s of sources) {
    rows.push(
      ...(await db
        .select()
        .from(alertDeadLetter)
        .where(eq(alertDeadLetter.alertSourceId, s.id))
        .all()),
    );
  }
  return rows;
}

export async function incidentsFor(workspaceId: number) {
  return db
    .select()
    .from(incidentTable)
    .where(eq(incidentTable.workspaceId, workspaceId))
    .all();
}

export function webhookRequest(args: {
  provider: string;
  token?: string;
  body: unknown;
  useQueryKey?: boolean;
}): Request {
  const base = `http://localhost/v1/ingest/${args.provider}`;
  const url =
    args.useQueryKey && args.token
      ? `${base}?key=${encodeURIComponent(args.token)}`
      : base;
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (args.token && !args.useQueryKey) headers["x-openstatus-key"] = args.token;
  return new Request(url, {
    method: "POST",
    headers,
    body: JSON.stringify(args.body),
  });
}
