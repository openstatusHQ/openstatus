import { and, desc, eq, inArray, sql } from "@openstatus/db";
import { incident } from "@openstatus/db/src/schema";

import { type ServiceContext, getReadDb } from "../context";
import { requireIncidentFeature } from "./internal";
import { IncidentIdInput, ListIncidentsInput } from "./schemas";

const userColumns = {
  id: true,
  name: true,
  firstName: true,
  lastName: true,
  email: true,
} as const;

const statusOrder = sql`case ${incident.status} when 'open' then 0 when 'mitigated' then 1 when 'resolved' then 2 else 3 end`;

/** Open incidents first, then newest declared. */
export async function listIncidents(args: {
  ctx: ServiceContext;
  input?: ListIncidentsInput;
}) {
  const { ctx } = args;
  requireIncidentFeature(ctx);
  const input = ListIncidentsInput.parse(args.input ?? {});

  const where = and(
    eq(incident.workspaceId, ctx.workspace.id),
    input.status?.length ? inArray(incident.status, input.status) : undefined,
  );
  return getReadDb(ctx).query.incident.findMany({
    where,
    orderBy: [statusOrder, desc(incident.declaredAt), desc(incident.id)],
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
  requireIncidentFeature(ctx);
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
