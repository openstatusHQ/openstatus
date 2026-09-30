import type { IncidentEvent } from "@openstatus/db/src/schema";

import { requireScope } from "../auth";
import { type ServiceContext, withTransaction } from "../context";
import {
  appendIncidentEvent,
  assertNotClosed,
  getIncidentInWorkspace,
} from "./internal";
import { AddIncidentNoteInput } from "./schemas";

// The audit row is `incident_event.create`, written by `appendIncidentEvent`.
// oxlint-disable-next-line openstatus/services-mutation-guards
export async function addIncidentNote(args: {
  ctx: ServiceContext;
  input: AddIncidentNoteInput;
}): Promise<IncidentEvent> {
  const { ctx } = args;
  requireScope(ctx, "write");
  const input = AddIncidentNoteInput.parse(args.input);

  return withTransaction(ctx, async (tx) => {
    const existing = await getIncidentInWorkspace(
      tx,
      ctx.workspace.id,
      input.id,
    );
    assertNotClosed(existing);
    return appendIncidentEvent(tx, ctx, {
      incidentId: existing.id,
      type: "note",
      message: input.message,
    });
  });
}
