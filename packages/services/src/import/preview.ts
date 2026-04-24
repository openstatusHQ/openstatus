import { db as defaultDb } from "@openstatus/db";
import type { ImportSummary } from "@openstatus/importers";

import type { ServiceContext } from "../context";
import { ValidationError } from "../errors";
import { addLimitWarnings } from "./limits";
import { buildProviderConfig, createProvider } from "./provider";
import { PreviewImportInput } from "./schemas";

/**
 * Dry-run an import: fetches the source provider's resources, validates
 * credentials, and returns the full phase summary including warnings for
 * limits that would be hit if `run` were invoked with the same input.
 * Never writes to the db.
 */
export async function previewImport(args: {
  ctx: ServiceContext;
  input: PreviewImportInput;
}): Promise<ImportSummary> {
  const { ctx } = args;
  const input = PreviewImportInput.parse(args.input);
  const db = ctx.db ?? defaultDb;

  const provider = createProvider(input.provider);
  const providerConfig = buildProviderConfig({
    provider: input.provider,
    apiKey: input.apiKey,
    statuspagePageId: input.statuspagePageId,
    betterstackStatusPageId: input.betterstackStatusPageId,
    instatusPageId: input.instatusPageId,
    workspaceId: ctx.workspace.id,
    pageId: input.pageId,
  });

  const validation = await provider.validate({
    ...providerConfig,
    dryRun: true,
  });
  if (!validation.valid) {
    throw new ValidationError(
      `Provider validation failed: ${validation.error ?? "unknown error"}`,
    );
  }

  const summary = await provider.run({ ...providerConfig, dryRun: true });
  await addLimitWarnings(summary, {
    limits: ctx.workspace.limits,
    workspaceId: ctx.workspace.id,
    pageId: input.pageId,
    db,
    options: input.options,
  });
  return summary;
}
