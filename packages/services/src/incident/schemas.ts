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

// A note copied from elsewhere (Slack) may keep the time it was said, within
// a window that keeps the timeline honest for every caller of the verb.
export const NOTE_BACKDATE_MAX_MS = 30 * 24 * 60 * 60 * 1000;
export const NOTE_FUTURE_SKEW_MS = 60_000;

export function isAllowedNoteCreatedAt(date: Date, now = Date.now()): boolean {
  const ms = date.getTime();
  return (
    Number.isFinite(ms) &&
    ms <= now + NOTE_FUTURE_SKEW_MS &&
    ms >= now - NOTE_BACKDATE_MAX_MS
  );
}

export const AddIncidentNoteInput = z.object({
  id,
  message: note,
  createdAt: z.coerce
    .date()
    .refine((d) => isAllowedNoteCreatedAt(d), {
      message:
        "createdAt must be within the last 30 days and at most a minute ahead",
    })
    .nullish(),
  // The member who wrote the note when someone else copies it in (a pinned
  // Slack message). The actor stays the one who performed the action.
  createdBy: id.nullish(),
});
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
