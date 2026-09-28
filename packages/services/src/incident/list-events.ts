import { desc, eq } from "@openstatus/db";
import { incidentEvent } from "@openstatus/db/src/schema";

import { type ServiceContext, getReadDb } from "../context";
import { getIncidentInWorkspace } from "./internal";
import { ListIncidentEventsInput } from "./schemas";

/** The incident's timeline, newest first. */
export async function listIncidentEvents(args: {
  ctx: ServiceContext;
  input: ListIncidentEventsInput;
}) {
  const { ctx } = args;
  const input = ListIncidentEventsInput.parse(args.input);
  const db = getReadDb(ctx);
  const existing = await getIncidentInWorkspace(db, ctx.workspace.id, input.id);
  return db.query.incidentEvent.findMany({
    where: eq(incidentEvent.incidentId, existing.id),
    orderBy: [desc(incidentEvent.createdAt), desc(incidentEvent.id)],
    limit: input.limit,
    with: {
      createdByUser: {
        columns: {
          id: true,
          name: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  });
}
