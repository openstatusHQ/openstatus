import { getLogger } from "@logtape/logtape";
import { db as defaultDb, eq, sql } from "@openstatus/db";
import { integration } from "@openstatus/db/src/schema";
import { z } from "zod";

import type { ServiceContext } from "../context";
import type { ListIntegrationsInput } from "./schemas";

const logger = getLogger(["services", "integration"]);

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
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch (cause) {
    // Don't fail the whole list on one corrupt row, but make the
    // corruption observable so it can be triaged. `value` itself is
    // intentionally not logged — it could be arbitrary user data.
    logger.warn("integration row has malformed `data` JSON", {
      integrationId: rowId,
      cause: cause instanceof Error ? cause.message : "unknown",
    });
    return {};
  }
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
