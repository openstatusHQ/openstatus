import { and, desc, eq, inArray, isNotNull, isNull, sql } from "@openstatus/db";
import {
  type Incident,
  type IncidentStatus,
  incident,
} from "@openstatus/db/src/schema";

import { type ServiceContext, getReadDb } from "../context";
import { NotFoundError } from "../errors";
import { isFeatureEnabled } from "../features";
import { isDeletable } from "./delete";
import {
  INCIDENT_FEATURE,
  allowedTransitions,
  incidentUserColumns,
  requireIncidentFeature,
} from "./internal";
import { IncidentIdInput, ListIncidentsInput } from "./schemas";

const statusOrder = sql`case ${incident.status} when 'open' then 0 when 'mitigated' then 1 when 'resolved' then 2 else 3 end`;

export function toIncidentView<T extends Incident>(
  row: T,
): T & {
  allowedTransitions: ReadonlyArray<IncidentStatus>;
  deletable: boolean;
} {
  return {
    ...row,
    allowedTransitions: allowedTransitions(row),
    deletable: isDeletable(row),
  };
}

/** Open incidents first, then newest declared. */
export async function listIncidents(args: {
  ctx: ServiceContext;
  input?: ListIncidentsInput;
}) {
  const { ctx } = args;
  requireIncidentFeature(ctx);
  const input = ListIncidentsInput.parse(args.input ?? {});
  const db = getReadDb(ctx);

  const where = and(
    eq(incident.workspaceId, ctx.workspace.id),
    input.status?.length ? inArray(incident.status, input.status) : undefined,
    input.closed === undefined
      ? undefined
      : input.closed
        ? isNotNull(incident.closedAt)
        : isNull(incident.closedAt),
  );
  const items = await db.query.incident.findMany({
    where,
    orderBy: [statusOrder, desc(incident.declaredAt), desc(incident.id)],
    limit: input.limit,
    offset: input.offset,
    with: {
      commander: { columns: incidentUserColumns },
      statusReport: { columns: { id: true, title: true, status: true } },
    },
  });

  // A short page is the last page, so the count is only needed for a full one.
  let totalSize = input.offset + items.length;
  if (
    items.length === input.limit ||
    (items.length === 0 && input.offset > 0)
  ) {
    const row = await db
      .select({ count: sql<number>`count(*)` })
      .from(incident)
      .where(where)
      .get();
    totalSize = row?.count ?? totalSize;
  }
  return { items, totalSize };
}

export async function getIncident(args: {
  ctx: ServiceContext;
  input: IncidentIdInput;
}) {
  const { ctx } = args;
  requireIncidentFeature(ctx);
  const input = IncidentIdInput.parse(args.input);
  const row = await getReadDb(ctx).query.incident.findFirst({
    where: and(
      eq(incident.id, input.id),
      eq(incident.workspaceId, ctx.workspace.id),
    ),
    with: {
      commander: { columns: incidentUserColumns },
      declaredByUser: { columns: incidentUserColumns },
      resolvedByUser: { columns: incidentUserColumns },
      statusReport: {
        columns: { id: true, title: true, status: true, pageId: true },
      },
    },
  });
  return row ? toIncidentView(row) : undefined;
}

export async function getIncidentOrThrow(args: {
  ctx: ServiceContext;
  input: IncidentIdInput;
}) {
  const row = await getIncident(args);
  if (!row) throw new NotFoundError("incident", args.input.id);
  return row;
}

/** The incident a status report communicates, if any. */
export async function getIncidentForStatusReport(args: {
  ctx: ServiceContext;
  input: { statusReportId: number };
}) {
  const { ctx } = args;
  requireIncidentFeature(ctx);
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

/** The incident bound to a Slack channel, or `undefined`. Never throws on the gate. */
export async function getIncidentBySlackChannel(args: {
  ctx: ServiceContext;
  input: { teamId: string; channelId: string };
}) {
  const { ctx } = args;
  if (!isFeatureEnabled(ctx.workspace, INCIDENT_FEATURE)) return undefined;
  return getReadDb(ctx).query.incident.findFirst({
    where: and(
      eq(incident.workspaceId, ctx.workspace.id),
      eq(incident.slackTeamId, args.input.teamId),
      eq(incident.slackChannelId, args.input.channelId),
    ),
    with: {
      commander: { columns: incidentUserColumns },
      statusReport: { columns: { id: true, title: true, status: true } },
    },
  });
}
