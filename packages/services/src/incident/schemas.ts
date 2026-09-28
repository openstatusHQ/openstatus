import {
  incidentSeverity,
  incidentStatus,
} from "@openstatus/db/src/schema/incidents/constants";
import { z } from "zod";

const id = z.number().int();
const title = z.string().trim().min(1).max(256);
const summary = z.string().trim().min(1).max(4000);
const note = z.string().trim().min(1).max(10_000);

export const DeclareIncidentInput = z.object({
  title,
  severity: z.enum(incidentSeverity),
  summary: summary.optional(),
  commanderId: id.nullish(),
  startedAt: z.coerce.date().optional(),
  statusReportId: id.optional(),
  source: z
    .object({
      type: z.enum(["monitor_incident", "status_report"]),
      id,
    })
    .optional(),
});
export type DeclareIncidentInput = z.infer<typeof DeclareIncidentInput>;

export const UpdateIncidentInput = z.object({
  id,
  title: title.optional(),
  severity: z.enum(incidentSeverity).optional(),
  summary: summary.nullish(),
  commanderId: id.nullish(),
  startedAt: z.coerce.date().optional(),
});
export type UpdateIncidentInput = z.infer<typeof UpdateIncidentInput>;

export const SetIncidentStatusInput = z.object({
  id,
  status: z.enum(incidentStatus),
  note: note.optional(),
});
export type SetIncidentStatusInput = z.infer<typeof SetIncidentStatusInput>;

export const AddIncidentNoteInput = z.object({ id, message: note });
export type AddIncidentNoteInput = z.infer<typeof AddIncidentNoteInput>;

export const LinkIncidentStatusReportInput = z.object({
  id,
  statusReportId: id,
});
export type LinkIncidentStatusReportInput = z.infer<
  typeof LinkIncidentStatusReportInput
>;

export const IncidentIdInput = z.object({ id });
export type IncidentIdInput = z.infer<typeof IncidentIdInput>;

export const ListIncidentEventsInput = IncidentIdInput.extend({
  limit: z.number().int().min(1).optional(),
});
export type ListIncidentEventsInput = z.infer<typeof ListIncidentEventsInput>;

export const BindIncidentSlackChannelInput = z.object({
  id,
  teamId: z.string().min(1),
  channelId: z.string().min(1),
});
export type BindIncidentSlackChannelInput = z.infer<
  typeof BindIncidentSlackChannelInput
>;

export const ListIncidentsInput = z.object({
  status: z.array(z.enum(incidentStatus)).optional(),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
});
export type ListIncidentsInput = z.input<typeof ListIncidentsInput>;

export const CloseIncidentInput = z.object({
  id,
  /** Close without an approved postmortem. */
  skipPostmortem: z.boolean().optional(),
});
export type CloseIncidentInput = z.infer<typeof CloseIncidentInput>;

export const DraftPostmortemInput = z.object({
  id,
  content: z.string().trim().min(1).max(100_000),
  draftedBy: z.enum(["agent", "user"]).default("user"),
  sourceTranscript: z.string().max(2_000_000).nullish(),
});
export type DraftPostmortemInput = z.input<typeof DraftPostmortemInput>;

export const ApprovePostmortemInput = z.object({
  id,
  close: z.boolean().optional(),
});
export type ApprovePostmortemInput = z.infer<typeof ApprovePostmortemInput>;
