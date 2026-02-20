import { and, db, eq } from "@openstatus/db";
import {
  integration,
  selectWorkspaceSchema,
  workspace,
} from "@openstatus/db/src/schema";
import type { Workspace } from "@openstatus/db/src/schema/workspaces/validation";

export async function resolveWorkspace(
  teamId: string,
): Promise<Workspace | null> {
  const row = await db
    .select({ workspaceId: integration.workspaceId })
    .from(integration)
    .where(
      and(
        eq(integration.name, "slack-agent"),
        eq(integration.externalId, teamId),
      ),
    )
    .get();

  if (!row?.workspaceId) return null;

  const ws = await db
    .select()
    .from(workspace)
    .where(eq(workspace.id, row.workspaceId))
    .get();

  if (!ws) return null;

  const parsed = selectWorkspaceSchema.safeParse(ws);
  if (!parsed.success) return null;

  return parsed.data;
}
