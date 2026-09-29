import {
  incidentSeverity,
  incidentStatus,
} from "@openstatus/db/src/schema/incidents/constants";
import { z } from "zod";

import { tryGetActorUserId } from "../context";
import { NotFoundError } from "../errors";
import {
  addIncidentNote,
  declareIncident,
  displayName,
  getIncident,
  listIncidentEvents,
  listIncidents,
  setIncidentStatus,
  updateIncident,
} from "../incident";
import type { AgentTool, SummaryLine } from "./types";

const FEATURE = "incident-management";

const title = z.string().trim().min(1).max(256);
const summary = z.string().trim().min(1).max(4000);
const note = z.string().trim().min(1).max(10_000);

const personSchema = z.object({ id: z.number().int(), name: z.string() });

type Person = {
  id: number;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
} | null;

function person(row: Person) {
  return row ? { id: row.id, name: displayName(row) } : null;
}

const IncidentSummary = z.object({
  id: z.number().int(),
  title: z.string(),
  severity: z.enum(incidentSeverity),
  status: z.enum(incidentStatus),
  closed: z.boolean(),
  commander: personSchema.nullable(),
  declaredAt: z.string(),
  startedAt: z.string(),
  statusReportId: z.number().int().nullable(),
  slackChannelId: z.string().nullable(),
});

const ListIncidentsInput = z.object({
  status: z
    .array(z.enum(incidentStatus))
    .optional()
    .describe("Only incidents in these statuses. Omit for all."),
  limit: z.number().int().min(1).max(100).default(20),
});

const ListIncidentsOutput = z.object({ items: z.array(IncidentSummary) });

export const listIncidentsTool: AgentTool<
  z.infer<typeof ListIncidentsInput>,
  z.infer<typeof ListIncidentsOutput>
> = {
  name: "list_incidents",
  description:
    "List managed incidents in this workspace (declared by the team, not monitor downtime), open ones first.",
  scope: "read",
  destructive: false,
  feature: FEATURE,
  inputSchema: ListIncidentsInput,
  outputSchema: ListIncidentsOutput,
  async run({ ctx, input }) {
    const rows = await listIncidents({
      ctx,
      input: { status: input.status, limit: input.limit },
    });
    return {
      items: rows.map((row) => ({
        id: row.id,
        title: row.title,
        severity: row.severity,
        status: row.status,
        closed: row.closedAt !== null,
        commander: person(row.commander),
        declaredAt: row.declaredAt.toISOString(),
        startedAt: row.startedAt.toISOString(),
        statusReportId: row.statusReportId,
        slackChannelId: row.slackChannelId,
      })),
    };
  },
};

const GetIncidentInput = z.object({
  id: z.number().int().describe("Incident id, from list_incidents."),
});

const GetIncidentOutput = IncidentSummary.extend({
  summary: z.string().nullable(),
  declaredBy: personSchema.nullable(),
  statusReport: z
    .object({ id: z.number().int(), title: z.string(), status: z.string() })
    .nullable(),
  events: z.array(
    z.object({
      type: z.string(),
      message: z.string().nullable(),
      at: z.string(),
      by: personSchema.nullable(),
    }),
  ),
});

export const getIncidentTool: AgentTool<
  z.infer<typeof GetIncidentInput>,
  z.infer<typeof GetIncidentOutput>
> = {
  name: "get_incident",
  description:
    "Get one managed incident with its timeline (newest first, up to 50 events) and linked status report.",
  scope: "read",
  destructive: false,
  feature: FEATURE,
  inputSchema: GetIncidentInput,
  outputSchema: GetIncidentOutput,
  async run({ ctx, input }) {
    const row = await getIncident({ ctx, input });
    if (!row) throw new NotFoundError("incident", input.id);
    const events = await listIncidentEvents({
      ctx,
      input: { id: input.id, limit: 50 },
    });
    return {
      id: row.id,
      title: row.title,
      severity: row.severity,
      status: row.status,
      closed: row.closedAt !== null,
      commander: person(row.commander),
      declaredAt: row.declaredAt.toISOString(),
      startedAt: row.startedAt.toISOString(),
      statusReportId: row.statusReportId,
      slackChannelId: row.slackChannelId,
      summary: row.summary,
      declaredBy: person(row.declaredByUser),
      statusReport: row.statusReport
        ? {
            id: row.statusReport.id,
            title: row.statusReport.title,
            status: row.statusReport.status,
          }
        : null,
      events: events.map((e) => ({
        type: e.type,
        message: e.message,
        at: e.createdAt.toISOString(),
        by: person(e.createdByUser),
      })),
    };
  },
};

const IncidentWriteOutput = z.object({
  id: z.number().int(),
  title: z.string(),
  severity: z.enum(incidentSeverity),
  status: z.enum(incidentStatus),
});

function writeOutput(row: {
  id: number;
  title: string;
  severity: z.infer<typeof IncidentWriteOutput>["severity"];
  status: z.infer<typeof IncidentWriteOutput>["status"];
}) {
  return {
    id: row.id,
    title: row.title,
    severity: row.severity,
    status: row.status,
  };
}

const DeclareIncidentInput = z.object({
  title: title.describe("Short internal title."),
  severity: z
    .enum(incidentSeverity)
    .describe(
      "critical: major outage or data loss; major: significant degradation; minor: limited impact.",
    ),
  summary: summary.optional().describe("What is happening."),
  commanderId: z
    .number()
    .int()
    .optional()
    .describe(
      "Member leading the response. Omit to make the requester commander.",
    ),
  startedAt: z.iso
    .datetime()
    .optional()
    .describe("When the impact began, ISO 8601. Omit for now."),
  statusReportId: z
    .number()
    .int()
    .optional()
    .describe("Existing status report to link, from list_status_reports."),
});

export const declareIncidentTool: AgentTool<
  z.infer<typeof DeclareIncidentInput>,
  z.infer<typeof IncidentWriteOutput>
> = {
  name: "declare_incident",
  description:
    "Declare a managed incident: the team's internal record of an outage, with a timeline and a commander. Internal only — nothing is published; use create_status_report for public communication.",
  scope: "write",
  destructive: true,
  feature: FEATURE,
  inputSchema: DeclareIncidentInput,
  outputSchema: IncidentWriteOutput,
  approval: {
    summarize: (input) => ({
      title: `Declare incident: ${input.title}`,
      lines: [
        { label: "Title", value: input.title },
        { label: "Severity", value: input.severity },
        ...optionalLines([
          ["Summary", input.summary],
          ["Started at", input.startedAt],
          [
            "Commander",
            input.commanderId ? `#${input.commanderId}` : undefined,
          ],
          [
            "Status report",
            input.statusReportId ? `#${input.statusReportId}` : undefined,
          ],
        ]),
      ],
    }),
    verb: "declared",
  },
  async run({ ctx, input }) {
    const row = await declareIncident({
      ctx,
      input: {
        title: input.title,
        severity: input.severity,
        summary: input.summary,
        commanderId: input.commanderId ?? tryGetActorUserId(ctx.actor),
        startedAt: input.startedAt ? new Date(input.startedAt) : undefined,
        statusReportId: input.statusReportId,
      },
    });
    return writeOutput(row);
  },
};

const UpdateIncidentInput = z.object({
  id: z.number().int().describe("Incident id, from list_incidents."),
  title: title.optional(),
  severity: z.enum(incidentSeverity).optional(),
  summary: summary.nullish().describe("New summary, or null to clear it."),
  commanderId: z
    .number()
    .int()
    .nullish()
    .describe("New commander's user id, or null to unassign."),
  startedAt: z.iso.datetime().optional().describe("Corrected start, ISO 8601."),
});

export const updateIncidentTool: AgentTool<
  z.infer<typeof UpdateIncidentInput>,
  z.infer<typeof IncidentWriteOutput>
> = {
  name: "update_incident",
  description:
    "Change a managed incident's title, severity, summary, commander or start time. Internal only.",
  scope: "write",
  destructive: true,
  feature: FEATURE,
  inputSchema: UpdateIncidentInput,
  outputSchema: IncidentWriteOutput,
  approval: {
    summarize: (input) => ({
      title: `Update incident #${input.id}`,
      lines: optionalLines([
        ["Title", input.title],
        ["Severity", input.severity],
        ["Summary", input.summary === null ? "(cleared)" : input.summary],
        [
          "Commander",
          input.commanderId === null
            ? "(unassigned)"
            : input.commanderId
              ? `#${input.commanderId}`
              : undefined,
        ],
        ["Started at", input.startedAt],
      ]),
    }),
    verb: "updated",
  },
  async run({ ctx, input }) {
    const row = await updateIncident({
      ctx,
      input: {
        id: input.id,
        title: input.title,
        severity: input.severity,
        summary: input.summary,
        commanderId: input.commanderId,
        startedAt: input.startedAt ? new Date(input.startedAt) : undefined,
      },
    });
    return writeOutput(row);
  },
};

const ResolveIncidentInput = z.object({
  id: z.number().int().describe("Incident id, from list_incidents."),
  note: note.optional().describe("What fixed it."),
});

export const resolveIncidentTool: AgentTool<
  z.infer<typeof ResolveIncidentInput>,
  z.infer<typeof IncidentWriteOutput>
> = {
  name: "resolve_incident",
  description:
    "Mark a managed incident resolved. Does not touch its status report: resolve that separately with resolve_status_report if it is still open.",
  scope: "write",
  destructive: true,
  feature: FEATURE,
  inputSchema: ResolveIncidentInput,
  outputSchema: IncidentWriteOutput,
  approval: {
    summarize: (input) => ({
      title: `Resolve incident #${input.id}`,
      lines: optionalLines([["Note", input.note]]),
    }),
    verb: "resolved",
  },
  async run({ ctx, input }) {
    const row = await setIncidentStatus({
      ctx,
      input: {
        id: input.id,
        status: "resolved",
        note: input.note,
      },
    });
    return writeOutput(row);
  },
};

const AddIncidentNoteInput = z.object({
  id: z.number().int().describe("Incident id, from list_incidents."),
  message: note.describe("The note, markdown."),
});

const AddIncidentNoteOutput = z.object({
  incidentId: z.number().int(),
  eventId: z.number().int(),
});

export const addIncidentNoteTool: AgentTool<
  z.infer<typeof AddIncidentNoteInput>,
  z.infer<typeof AddIncidentNoteOutput>
> = {
  name: "add_incident_note",
  description:
    "Append a note to a managed incident's timeline. Internal and append-only.",
  scope: "write",
  destructive: false,
  feature: FEATURE,
  inputSchema: AddIncidentNoteInput,
  outputSchema: AddIncidentNoteOutput,
  async run({ ctx, input }) {
    const event = await addIncidentNote({ ctx, input });
    return { incidentId: input.id, eventId: event.id };
  },
};

function optionalLines(
  entries: Array<[string, string | undefined]>,
): SummaryLine[] {
  return entries.flatMap(([label, value]) => (value ? [{ label, value }] : []));
}
