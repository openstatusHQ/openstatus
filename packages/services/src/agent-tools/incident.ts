import { z } from "zod";

import {
  acknowledgeIncident,
  createIncident,
  getIncident,
  listIncidents,
  resolveIncident,
  updateIncident,
} from "../incident";
import type { AgentTool } from "./types";

const IncidentOutput = z.object({
  id: z.number(),
  title: z.string(),
  summary: z.string(),
  status: z.string(),
  severity: z.string(),
  origin: z.string(),
  startedAt: z.string(),
  lastSeenAt: z.string(),
  acknowledgedAt: z.string().nullable(),
  resolvedAt: z.string().nullable(),
  autoResolved: z.boolean(),
  statusReportId: z.number().nullable(),
});

type IncidentRow = {
  id: number;
  title: string;
  summary: string;
  status: string;
  severity: string;
  origin: string;
  startedAt: Date;
  lastSeenAt: Date;
  acknowledgedAt: Date | null;
  resolvedAt: Date | null;
  autoResolved: boolean;
  statusReportId: number | null;
};

function toOutput(incident: IncidentRow): z.infer<typeof IncidentOutput> {
  return {
    id: incident.id,
    title: incident.title,
    summary: incident.summary,
    status: incident.status,
    severity: incident.severity,
    origin: incident.origin,
    startedAt: incident.startedAt.toISOString(),
    lastSeenAt: incident.lastSeenAt.toISOString(),
    acknowledgedAt: incident.acknowledgedAt?.toISOString() ?? null,
    resolvedAt: incident.resolvedAt?.toISOString() ?? null,
    autoResolved: incident.autoResolved,
    statusReportId: incident.statusReportId,
  };
}

const ListIncidentsInputShape = z.object({
  filter: z.enum(["all", "open"]).default("open"),
  origin: z.enum(["monitor", "external", "manual"]).optional(),
  perPage: z.number().int().positive().max(100).default(20),
});

const ListIncidentsOutput = z.object({ items: z.array(IncidentOutput) });

export const listIncidentsTool: AgentTool<
  z.infer<typeof ListIncidentsInputShape>,
  z.infer<typeof ListIncidentsOutput>
> = {
  name: "list_incidents",
  description:
    "List workspace incidents, newest first. An incident is internal triage state — something is wrong, whether it came from an openstatus monitor, an ingested third-party alert, or a person. It is not public until promoted to a status report. Use `filter: 'open'` to see what is still unresolved.",
  scope: "read",
  destructive: false,
  inputSchema: ListIncidentsInputShape,
  outputSchema: ListIncidentsOutput,
  async run({ ctx, input }) {
    const { items } = await listIncidents({
      ctx,
      input: { origin: input.origin, limit: input.perPage, order: "desc" },
    });
    const filtered =
      input.filter === "open" ? items.filter((i) => !i.resolvedAt) : items;
    return { items: filtered.map(toOutput) };
  },
};

const GetIncidentInputShape = z.object({ id: z.number().int() });

export const getIncidentTool: AgentTool<
  z.infer<typeof GetIncidentInputShape>,
  z.infer<typeof IncidentOutput>
> = {
  name: "get_incident",
  description:
    "Fetch one workspace incident by id, including its triage status, severity, origin, and whether it has been published as a status report.",
  scope: "read",
  destructive: false,
  inputSchema: GetIncidentInputShape,
  outputSchema: IncidentOutput,
  async run({ ctx, input }) {
    return toOutput(await getIncident({ ctx, input: { id: input.id } }));
  },
};

const CreateIncidentInputShape = z.object({
  title: z.string().min(1).max(256),
  summary: z.string().default(""),
  severity: z.enum(["critical", "warning", "info"]).default("warning"),
});

export const createIncidentTool: AgentTool<
  z.infer<typeof CreateIncidentInputShape>,
  z.infer<typeof IncidentOutput>
> = {
  name: "create_incident",
  description:
    "Open a workspace incident by hand. Incidents raised from ingested alerts are created automatically — use this only for something a human noticed.",
  scope: "write",
  destructive: false,
  inputSchema: CreateIncidentInputShape,
  outputSchema: IncidentOutput,
  async run({ ctx, input }) {
    return toOutput(
      await createIncident({
        ctx,
        input: {
          title: input.title,
          summary: input.summary,
          severity: input.severity,
          origin: "manual",
        },
      }),
    );
  },
};

const UpdateIncidentInputShape = z.object({
  id: z.number().int(),
  title: z.string().min(1).max(256).optional(),
  summary: z.string().optional(),
  status: z
    .enum(["triage", "investigating", "identified", "monitoring", "resolved"])
    .optional(),
  severity: z.enum(["critical", "warning", "info"]).optional(),
});

export const updateIncidentTool: AgentTool<
  z.infer<typeof UpdateIncidentInputShape>,
  z.infer<typeof IncidentOutput>
> = {
  name: "update_incident",
  description:
    "Change an incident's title, summary, triage status or severity.",
  scope: "write",
  destructive: false,
  inputSchema: UpdateIncidentInputShape,
  outputSchema: IncidentOutput,
  async run({ ctx, input }) {
    return toOutput(await updateIncident({ ctx, input }));
  },
};

const IncidentIdInputShape = z.object({ id: z.number().int() });

export const acknowledgeIncidentTool: AgentTool<
  z.infer<typeof IncidentIdInputShape>,
  z.infer<typeof IncidentOutput>
> = {
  name: "acknowledge_incident",
  description:
    "Record that someone has picked this incident up. Moves a triage incident to investigating.",
  scope: "write",
  destructive: false,
  inputSchema: IncidentIdInputShape,
  outputSchema: IncidentOutput,
  async run({ ctx, input }) {
    return toOutput(
      await acknowledgeIncident({ ctx, input: { id: input.id } }),
    );
  },
};

export const resolveIncidentTool: AgentTool<
  z.infer<typeof IncidentIdInputShape>,
  z.infer<typeof IncidentOutput>
> = {
  name: "resolve_incident",
  description:
    "Close a workspace incident, marking it resolved. Does not publish anything — a status report, if one exists, is resolved separately.",
  scope: "write",
  destructive: false,
  inputSchema: IncidentIdInputShape,
  outputSchema: IncidentOutput,
  async run({ ctx, input }) {
    return toOutput(await resolveIncident({ ctx, input: { id: input.id } }));
  },
};
