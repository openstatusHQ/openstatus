import {
  type SQL,
  and,
  asc,
  db as defaultDb,
  desc,
  eq,
  gte,
} from "@openstatus/db";
import { incidentTable } from "@openstatus/db/src/schema";
import type { z } from "zod";

import type { ServiceContext } from "../context";
import type { Incident } from "../types";
import { getIncidentInWorkspace } from "./internal";
import {
  GetIncidentInput,
  type IncidentListPeriod,
  ListIncidentsInput,
} from "./schemas";

function periodToSince(period: IncidentListPeriod): Date {
  const day = 24 * 60 * 60 * 1000;
  const now = Date.now();
  switch (period) {
    case "1d":
      return new Date(now - 1 * day);
    case "7d":
      return new Date(now - 7 * day);
    case "14d":
      return new Date(now - 14 * day);
    case "30d":
      return new Date(now - 30 * day);
  }
}

export type ListIncidentsResult = {
  items: Incident[];
};

export async function listIncidents(args: {
  ctx: ServiceContext;
  input?: z.input<typeof ListIncidentsInput>;
}): Promise<ListIncidentsResult> {
  const { ctx } = args;
  const input = ListIncidentsInput.parse(args.input ?? {});
  const tx = ctx.db ?? defaultDb;

  const conditions: SQL[] = [eq(incidentTable.workspaceId, ctx.workspace.id)];
  if (input.period) {
    conditions.push(gte(incidentTable.startedAt, periodToSince(input.period)));
  }
  if (input.status) conditions.push(eq(incidentTable.status, input.status));
  if (input.origin) conditions.push(eq(incidentTable.origin, input.origin));

  const items = await tx
    .select()
    .from(incidentTable)
    .where(and(...conditions))
    .orderBy(
      input.order === "asc"
        ? asc(incidentTable.startedAt)
        : desc(incidentTable.startedAt),
    )
    .limit(input.limit)
    .offset(input.offset)
    .all();

  return { items };
}

export async function getIncident(args: {
  ctx: ServiceContext;
  input: GetIncidentInput;
}): Promise<Incident> {
  const { ctx } = args;
  const input = GetIncidentInput.parse(args.input);
  const tx = ctx.db ?? defaultDb;
  return getIncidentInWorkspace({
    tx,
    id: input.id,
    workspaceId: ctx.workspace.id,
  });
}
