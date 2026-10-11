import { and, desc, eq, inArray, isNotNull } from "@openstatus/db";
import { incident } from "@openstatus/db/src/schema";

import { type ServiceContext, getReadDb } from "../context";
import { IncidentIdInput, ListIncidentsInput } from "./schemas";

const userColumns = {
  id: true,
  name: true,
  firstName: true,
  lastName: true,
  email: true,
  photoUrl: true,
  deletedAt: true,
} as const;

/** Newest declared first. */
export async function listIncidents(args: {
  ctx: ServiceContext;
  input?: ListIncidentsInput;
}) {
  const { ctx } = args;
  const input = ListIncidentsInput.parse(args.input ?? {});

  const where = and(
    eq(incident.workspaceId, ctx.workspace.id),
    input.status?.length ? inArray(incident.status, input.status) : undefined,
  );
  return getReadDb(ctx).query.incident.findMany({
    where,
    orderBy: [desc(incident.declaredAt), desc(incident.id)],
    limit: input.limit,
    offset: input.offset,
    with: {
      commander: { columns: userColumns },
      statusReport: { columns: { id: true, title: true, status: true } },
    },
  });
}

export async function getIncident(args: {
  ctx: ServiceContext;
  input: IncidentIdInput;
}) {
  const { ctx } = args;
  const input = IncidentIdInput.parse(args.input);
  return getReadDb(ctx).query.incident.findFirst({
    where: and(
      eq(incident.id, input.id),
      eq(incident.workspaceId, ctx.workspace.id),
    ),
    with: {
      commander: { columns: userColumns },
      declaredByUser: { columns: userColumns },
      resolvedByUser: { columns: userColumns },
      statusReport: {
        columns: { id: true, title: true, status: true, pageId: true },
      },
    },
  });
}

/** The incident a status report communicates, if any. */
export async function getIncidentForStatusReport(args: {
  ctx: ServiceContext;
  input: { statusReportId: number };
}) {
  const { ctx } = args;
  return getReadDb(ctx)
    .select({ id: incident.id, title: incident.title, status: incident.status })
    .from(incident)
    .where(
      and(
        eq(incident.workspaceId, ctx.workspace.id),
        eq(incident.statusReportId, args.input.statusReportId),
      ),
    )
    .get();
}

/** Status reports already held by an incident; each links to at most one. */
export async function listLinkedStatusReportIds(args: {
  ctx: ServiceContext;
}): Promise<number[]> {
  const { ctx } = args;
  const rows = await getReadDb(ctx)
    .select({ statusReportId: incident.statusReportId })
    .from(incident)
    .where(
      and(
        eq(incident.workspaceId, ctx.workspace.id),
        isNotNull(incident.statusReportId),
      ),
    )
    .all();
  return rows.flatMap((r) =>
    r.statusReportId === null ? [] : [r.statusReportId],
  );
}

/** The incident bound to a Slack channel, or `undefined`. */
export async function getIncidentBySlackChannel(args: {
  ctx: ServiceContext;
  input: { teamId: string; channelId: string };
}) {
  const { ctx } = args;
  return getReadDb(ctx).query.incident.findFirst({
    where: and(
      eq(incident.workspaceId, ctx.workspace.id),
      eq(incident.slackTeamId, args.input.teamId),
      eq(incident.slackChannelId, args.input.channelId),
    ),
    with: {
      commander: { columns: userColumns },
      statusReport: { columns: { id: true, title: true, status: true } },
    },
  });
}
