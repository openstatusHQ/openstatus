import { eq } from "@openstatus/db";
import {
  monitorIncidentTable,
  selectWorkspaceSchema,
  workspace,
} from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { type DB, withTransaction, dbOnlyContext } from "../context";
import { NotFoundError } from "../errors";
import { SetMonitorIncidentScreenshotInput } from "./schemas";

/**
 * Attach the screenshot taken when an outage opened or recovered. Returns
 * false when the incident no longer exists.
 */
// Addressed by incident id alone: the screenshot job knows no workspace, so
// the row is audited in the incident's own workspace as a system actor.
// oxlint-disable-next-line openstatus/services-mutation-guards
export async function setMonitorIncidentScreenshot(args: {
  input: SetMonitorIncidentScreenshotInput;
  job: string;
  db?: DB;
}): Promise<boolean> {
  const input = SetMonitorIncidentScreenshotInput.parse(args.input);
  const column =
    input.kind === "incident"
      ? "incidentScreenshotUrl"
      : "recoveryScreenshotUrl";

  return withTransaction(dbOnlyContext(args.db), async (tx) => {
    const before = await tx
      .select()
      .from(monitorIncidentTable)
      .where(eq(monitorIncidentTable.id, input.id))
      .get();
    if (!before) return false;

    const after = await tx
      .update(monitorIncidentTable)
      .set({ [column]: input.url })
      .where(eq(monitorIncidentTable.id, input.id))
      .returning()
      .get();
    if (!after) return false;

    // Incidents older than the workspace column have no trail to write to.
    if (before.workspaceId === null) return true;
    const owner = await tx
      .select()
      .from(workspace)
      .where(eq(workspace.id, before.workspaceId))
      .get();
    if (!owner) throw new NotFoundError("workspace", before.workspaceId);

    await emitAudit(
      tx,
      {
        workspace: selectWorkspaceSchema.parse(owner),
        actor: { type: "system", job: args.job },
        db: tx,
      },
      {
        action: "monitor_incident.update",
        entityType: "monitor_incident",
        entityId: after.id,
        before,
        after,
      },
    );
    return true;
  });
}
