import { and, desc, eq, inArray, isNotNull, isNull, sql } from "@openstatus/db";
import {
  type Incident,
  type IncidentSlaState,
  type IncidentStatus,
  incident,
  incidentSlaState,
  incidentUpdateCadence,
} from "@openstatus/db/src/schema";

import { requireScope } from "../auth";
import { type DB, type ServiceContext, getReadDb } from "../context";
import { NotFoundError } from "../errors";
import { isDeletable } from "./delete";
import { allowedTransitions, incidentUserColumns } from "./internal";
import { IncidentIdInput, ListIncidentsInput } from "./schemas";
import {
  loadIncidentUpdateActivity,
  noUpdateActivity,
} from "./update-activity";

export function toIncidentView<T extends Incident>(
  row: T,
  now: Date = new Date(),
): T & {
  allowedTransitions: ReadonlyArray<IncidentStatus>;
  deletable: boolean;
  sla: IncidentSlaState | null;
} {
  return {
    ...row,
    allowedTransitions: allowedTransitions(row),
    deletable: isDeletable(row),
    sla: incidentSlaState(row, now),
  };
}

const incidentListWith = {
  commander: { columns: incidentUserColumns },
  acknowledgedByUser: { columns: incidentUserColumns },
  statusReport: { columns: { id: true, title: true, status: true } },
} as const;

// only open, tracked incidents can have an active update cadence
async function withUpdateActivity<T extends Incident>(db: DB, rows: T[]) {
  const activity = await loadIncidentUpdateActivity(
    db,
    rows.filter((row) => row.slaSnapshot !== null && row.closedAt === null),
  );
  return rows.map((row) => ({
    ...toIncidentView(row),
    updateActivity: activity.get(row.id) ?? noUpdateActivity(row),
  }));
}

function listWhere(
  ctx: ServiceContext,
  input: Pick<ListIncidentsInput, "status" | "closed">,
) {
  return and(
    eq(incident.workspaceId, ctx.workspace.id),
    input.status?.length ? inArray(incident.status, input.status) : undefined,
    input.closed === undefined
      ? undefined
      : input.closed
        ? isNotNull(incident.closedAt)
        : isNull(incident.closedAt),
  );
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

  const where = listWhere(ctx, input);
  const items = await withUpdateActivity(
    db,
    await db.query.incident.findMany({
      where,
      orderBy: [desc(incident.declaredAt), desc(incident.id)],
      limit: input.limit,
      offset: input.offset,
      with: incidentListWith,
    }),
  );

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

/** Every matching incident in one read, newest declared first; for dashboard calendars and counts. */
export async function listAllIncidents(args: {
  ctx: ServiceContext;
  input?: Pick<ListIncidentsInput, "status" | "closed">;
}) {
  requireScope(args.ctx, "incidents:read");
  const db = getReadDb(args.ctx);
  const rows = await db.query.incident.findMany({
    where: listWhere(args.ctx, args.input ?? {}),
    orderBy: [desc(incident.declaredAt), desc(incident.id)],
    with: incidentListWith,
  });
  return withUpdateActivity(db, rows);
}

export async function getIncident(args: {
  ctx: ServiceContext;
  input: IncidentIdInput;
}) {
  const { ctx } = args;
  requireScope(ctx, "incidents:read");
  const input = IncidentIdInput.parse(args.input);
  const db = getReadDb(ctx);
  const row = await db.query.incident.findFirst({
    where: and(
      eq(incident.id, input.id),
      eq(incident.workspaceId, ctx.workspace.id),
    ),
    with: {
      commander: { columns: incidentUserColumns },
      declaredByUser: { columns: incidentUserColumns },
      resolvedByUser: { columns: incidentUserColumns },
      acknowledgedByUser: { columns: incidentUserColumns },
      statusReport: {
        columns: { id: true, title: true, status: true, pageId: true },
      },
    },
  });
  if (!row) return undefined;
  const now = new Date();
  const updateActivity =
    (await loadIncidentUpdateActivity(db, [row])).get(row.id) ??
    noUpdateActivity(row);
  return {
    ...toIncidentView(row, now),
    updateActivity,
    updateCadence: incidentUpdateCadence(row, updateActivity, now),
  };
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
