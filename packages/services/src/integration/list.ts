import { db as defaultDb, eq, sql } from "@openstatus/db";
import { integration } from "@openstatus/db/src/schema";
import { z } from "zod";

import type { ServiceContext } from "../context";
import { ListIntegrationsInput } from "./schemas";

const integrationSummarySchema = z.object({
  id: z.number(),
  name: z.string(),
  externalId: z.string(),
  data: z.record(z.string(), z.unknown()),
  createdAt: z.coerce.date().nullable(),
});

export type IntegrationSummary = z.infer<typeof integrationSummarySchema>;

function safeJsonParse(
  rowId: number,
  value: string | null,
): Record<string, unknown> {
  if (!value) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch (cause) {
    console.warn("integration row has malformed `data` JSON", {
      integrationId: rowId,
      cause: cause instanceof Error ? cause.message : "unknown",
    });
    return {};
  }
  // Valid JSON but wrong shape (string, number, array, null) would fail
  // the row-level `z.record` check and crash the whole list.
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    console.warn("integration row has non-object `data` JSON", {
      integrationId: rowId,
    });
    return {};
  }
  return parsed as Record<string, unknown>;
}

/**
 * List integrations for the caller's workspace. `data` is stored as a
 * JSON-mode text column; we force-cast to raw text with `sql<string>` so
 * malformed rows don't break the whole list (fall back to `{}`). The
 * `credential` column is never selected — it carries secrets and is not
 * part of the list contract.
 */
export async function listIntegrations(args: {
  ctx: ServiceContext;
  input?: ListIntegrationsInput;
}): Promise<IntegrationSummary[]> {
  ListIntegrationsInput.parse(args.input ?? {});
  const db = args.ctx.db ?? defaultDb;

  const rows = await db
    .select({
      id: integration.id,
      name: integration.name,
      externalId: integration.externalId,
      rawData: sql<string>`${integration.data}`,
      createdAt: integration.createdAt,
    })
    .from(integration)
    .where(eq(integration.workspaceId, args.ctx.workspace.id))
    .all();

  return integrationSummarySchema.array().parse(
    rows.map((row) => ({
      id: row.id,
      name: row.name,
      externalId: row.externalId,
      data: safeJsonParse(row.id, row.rawData),
      createdAt: row.createdAt,
    })),
  );
}
