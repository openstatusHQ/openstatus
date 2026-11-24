// oxlint-disable-next-line no-restricted-imports -- existing offender, migrate to @openstatus/services
import { db, eq, schema } from "@openstatus/db";
import { selectWorkspaceSchema } from "@openstatus/db/src/schema";
import type { ServiceContext } from "@openstatus/services";

/** A system job acting on a workspace; throws when the workspace is gone. */
export async function systemContext(
  workspaceId: number | null,
  job: string,
): Promise<ServiceContext> {
  const row =
    workspaceId === null
      ? undefined
      : await db
          .select()
          .from(schema.workspace)
          .where(eq(schema.workspace.id, workspaceId))
          .get();
  if (!row) throw new Error(`workspace ${workspaceId} not found`);
  return {
    workspace: selectWorkspaceSchema.parse(row),
    actor: { type: "system", job },
  };
}
