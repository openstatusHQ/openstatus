import { and, desc, eq } from "@openstatus/db";
import { incidentEvent } from "@openstatus/db/src/schema";

import { requireScope } from "../auth";
import { type ServiceContext, getReadDb } from "../context";
import { getIncidentInWorkspace, incidentUserColumns } from "./internal";
import { withLegacySource } from "./legacy-source";
import { GetIncidentEventInput, ListIncidentEventsInput } from "./schemas";

/** The incident's timeline, newest first, with legacy Slack notes normalized. */
export async function listIncidentEvents(args: {
  ctx: ServiceContext;
  input: ListIncidentEventsInput;
}) {
  const { ctx } = args;
  requireScope(ctx, "incidents:read");
  const input = ListIncidentEventsInput.parse(args.input);
  const db = getReadDb(ctx);
  const existing = await getIncidentInWorkspace(db, ctx.workspace.id, input.id);
  const rows = await db.query.incidentEvent.findMany({
    where: eq(incidentEvent.incidentId, existing.id),
    orderBy: [desc(incidentEvent.createdAt), desc(incidentEvent.id)],
    limit: input.limit,
    with: {
      createdByUser: { columns: incidentUserColumns },
    },
  });
  return rows.map(withLegacySource);
}

/** One timeline event of the incident, or null when it isn't on it. */
export async function getIncidentEvent(args: {
  ctx: ServiceContext;
  input: GetIncidentEventInput;
}) {
  const { ctx } = args;
  requireScope(ctx, "incidents:read");
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
  return event ? withLegacySource(event) : null;
}
