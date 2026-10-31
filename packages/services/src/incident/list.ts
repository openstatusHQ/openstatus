import { and, desc, eq, inArray, isNotNull, isNull, sql } from "@openstatus/db";
import {
  type Incident,
  type IncidentStatus,
  incident,
} from "@openstatus/db/src/schema";

import { requireScope } from "../auth";
import { type ServiceContext, getReadDb } from "../context";
import { NotFoundError } from "../errors";
import { isDeletable } from "./delete";
import { allowedTransitions, incidentUserColumns } from "./internal";
import { IncidentIdInput, ListIncidentsInput } from "./schemas";

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

/** Newest declared first. */
export async function listIncidents(args: {
  ctx: ServiceContext;
  input?: ListIncidentsInput;
}) {
  const { ctx } = args;
  requireScope(ctx, "incidents:read");
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
    orderBy: [desc(incident.declaredAt), desc(incident.id)],
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
  requireScope(ctx, "incidents:read");
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
  requireScope(args.ctx, "incidents:read");
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
  requireScope(ctx, "incidents:read");
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
  requireScope(ctx, "incidents:read");
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
  requireScope(ctx, "incidents:read");
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
