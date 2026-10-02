import {
  incidentSeverity,
  incidentStatus,
} from "@openstatus/db/src/schema/incidents/constants";
import { z } from "zod";

import { attributedUserSchema, toAttributedUser } from "../attribution";
import { tryGetActorUserId } from "../context";
import { NotFoundError } from "../errors";
import {
  addIncidentNote,
  approvePostmortem,
  declareIncident,
  draftPostmortem,
  getIncident,
  getPostmortem,
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

const IncidentSummary = z.object({
  id: z.number().int(),
  title: z.string(),
  severity: z.enum(incidentSeverity),
  status: z.enum(incidentStatus),
  closed: z.boolean(),
  commander: attributedUserSchema.nullable(),
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
    const { items: rows } = await listIncidents({
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
        commander: toAttributedUser(row.commander),
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
  declaredBy: attributedUserSchema.nullable(),
  statusReport: z
    .object({ id: z.number().int(), title: z.string(), status: z.string() })
    .nullable(),
  events: z.array(
    z.object({
      type: z.string(),
      message: z.string().nullable(),
      at: z.string(),
      by: attributedUserSchema.nullable(),
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
      commander: toAttributedUser(row.commander),
      declaredAt: row.declaredAt.toISOString(),
      startedAt: row.startedAt.toISOString(),
      statusReportId: row.statusReportId,
      slackChannelId: row.slackChannelId,
      summary: row.summary,
      declaredBy: toAttributedUser(row.declaredByUser),
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
        by: toAttributedUser(e.createdByUser),
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

const SetIncidentStatusInput = z.object({
  id: z.number().int().describe("Incident id, from list_incidents."),
  status: z
    .enum(incidentStatus)
    .describe(
      "mitigated: impact stopped, not fixed yet. resolved: fixed. canceled: false alarm or declared by mistake. open: reopen.",
    ),
  note: z.string().max(10_000).optional().describe("Why, in a sentence."),
});

export const setIncidentStatusTool: AgentTool<
  z.infer<typeof SetIncidentStatusInput>,
  z.infer<typeof IncidentWriteOutput>
> = {
  name: "set_incident_status",
  description:
    "Move a managed incident to mitigated, resolved, canceled (false alarm) or back to open. Canceling closes it for good. Does not touch its status report.",
  scope: "write",
  destructive: true,
  feature: FEATURE,
  inputSchema: SetIncidentStatusInput,
  outputSchema: IncidentWriteOutput,
  approval: {
    summarize: (input) => ({
      title: `Mark incident #${input.id} ${input.status}`,
      lines: optionalLines([["Note", input.note]]),
    }),
    verb: "updated",
  },
  async run({ ctx, input }) {
    const row = await setIncidentStatus({
      ctx,
      input: {
        id: input.id,
        status: input.status,
        note: input.note?.trim() || undefined,
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

const PostmortemInput = z.object({
  id: z.number().int().describe("Incident id, from list_incidents."),
});

const GetPostmortemOutput = z.object({
  incidentId: z.number().int(),
  exists: z.boolean(),
  status: z.enum(["draft", "approved"]).nullable(),
  content: z.string().nullable(),
  draftedBy: z.enum(["agent", "user"]).nullable(),
});

export const getPostmortemTool: AgentTool<
  z.infer<typeof PostmortemInput>,
  z.infer<typeof GetPostmortemOutput>
> = {
  name: "get_postmortem",
  description:
    "Read a managed incident's postmortem (markdown), if one was drafted.",
  scope: "read",
  destructive: false,
  feature: FEATURE,
  inputSchema: PostmortemInput,
  outputSchema: GetPostmortemOutput,
  async run({ ctx, input }) {
    const row = await getPostmortem({ ctx, input });
    return {
      incidentId: input.id,
      exists: row !== undefined,
      status: row?.status ?? null,
      content: row?.content ?? null,
      draftedBy: row?.draftedBy ?? null,
    };
  },
};

const DraftPostmortemToolInput = PostmortemInput.extend({
  content: z
    .string()
    .min(1)
    .max(100_000)
    .describe(
      "The postmortem in markdown with sections Summary, Impact, Timeline, Root cause, What went well, What went wrong, Action items.",
    ),
});

const DraftPostmortemOutput = z.object({
  incidentId: z.number().int(),
  status: z.enum(["draft", "approved"]),
});

export const draftPostmortemTool: AgentTool<
  z.infer<typeof DraftPostmortemToolInput>,
  z.infer<typeof DraftPostmortemOutput>
> = {
  name: "draft_postmortem",
  description:
    "Save a postmortem draft for a resolved managed incident. Build it from get_incident (timeline, linked status report) and the conversation; never invent facts. Replaces an existing draft; an approved postmortem can't be redrafted.",
  scope: "write",
  destructive: true,
  feature: FEATURE,
  inputSchema: DraftPostmortemToolInput,
  outputSchema: DraftPostmortemOutput,
  approval: {
    summarize: (input) => ({
      title: `Save or replace the postmortem draft of incident #${input.id}`,
      lines: [
        {
          label: "Draft",
          value:
            input.content.length > 600
              ? `${input.content.slice(0, 600)}…`
              : input.content,
        },
      ],
    }),
    verb: "saved",
  },
  async run({ ctx, input }) {
    const row = await draftPostmortem({
      ctx,
      input: { id: input.id, content: input.content, draftedBy: "agent" },
    });
    return { incidentId: input.id, status: row.status };
  },
};

const ApprovePostmortemToolInput = PostmortemInput.extend({
  close: z
    .boolean()
    .default(true)
    .describe("Also close the incident (the usual last step)."),
});

const ApprovePostmortemOutput = z.object({
  incidentId: z.number().int(),
  status: z.enum(["draft", "approved"]),
  closed: z.boolean().describe("Whether this call closed the incident."),
});

export const approvePostmortemTool: AgentTool<
  z.infer<typeof ApprovePostmortemToolInput>,
  z.infer<typeof ApprovePostmortemOutput>
> = {
  name: "approve_postmortem",
  description:
    "Approve a managed incident's postmortem draft and, by default, close the incident. Only an admin, owner or the incident's commander can approve.",
  scope: "write",
  destructive: true,
  feature: FEATURE,
  inputSchema: ApprovePostmortemToolInput,
  outputSchema: ApprovePostmortemOutput,
  approval: {
    summarize: (input) => ({
      title: `Approve the postmortem of incident #${input.id}`,
      lines: [
        {
          label: "Then",
          value: input.close === false ? "keep it open" : "close the incident",
        },
      ],
    }),
    verb: "approved",
  },
  async run({ ctx, input }) {
    const before = input.close
      ? await getIncident({ ctx, input: { id: input.id } })
      : undefined;
    const row = await approvePostmortem({
      ctx,
      input: { id: input.id, close: input.close },
    });
    return {
      incidentId: input.id,
      status: row.status,
      closed: Boolean(before && !before.closedAt),
    };
  },
};

function optionalLines(
  entries: Array<[string, string | undefined]>,
): SummaryLine[] {
  return entries.flatMap(([label, value]) => (value ? [{ label, value }] : []));
}
