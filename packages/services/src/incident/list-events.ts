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
    where: { incidentId: existing.id },
    orderBy: { createdAt: "desc", id: "desc" },
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
    where: { incidentId: existing.id, id: input.eventId },
    with: {
      createdByUser: { columns: incidentUserColumns },
    },
  });
  return event ? withLegacySource(event) : null;
}
