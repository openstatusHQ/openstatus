import { and, desc, eq } from "@openstatus/db";
import { incidentEvent } from "@openstatus/db/src/schema";

import { type ServiceContext, getReadDb } from "../context";
import { getIncidentInWorkspace, incidentUserColumns } from "./internal";
import { GetIncidentEventInput, ListIncidentEventsInput } from "./schemas";

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
      createdByUser: { columns: incidentUserColumns },
    },
  });
}

/** One timeline event of the incident, or null when it isn't on it. */
export async function getIncidentEvent(args: {
  ctx: ServiceContext;
  input: GetIncidentEventInput;
}) {
  const { ctx } = args;
  const input = GetIncidentEventInput.parse(args.input);
  const db = getReadDb(ctx);
  const existing = await getIncidentInWorkspace(db, ctx.workspace.id, input.id);
  const event = await db.query.incidentEvent.findFirst({
    where: and(
      eq(incidentEvent.incidentId, existing.id),
      eq(incidentEvent.id, input.eventId),
    ),
    with: {
      createdByUser: { columns: incidentUserColumns },
    },
  });
  return event ?? null;
}
