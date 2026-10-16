import { z } from "zod";

import type { CreatedRecord } from "./confirmation-store";

const statusReportOutput = z.object({
  statusReport: z.object({ id: z.number().int(), title: z.string() }),
});
const namedOutput = z.object({ id: z.number().int(), title: z.string() });

const KINDS: Record<string, CreatedRecord["kind"]> = {
  create_status_report: "status_report",
  add_status_report_update: "status_report",
  declare_incident: "incident",
  create_maintenance: "maintenance",
};

export function createdRecordFrom(
  toolName: string,
  output: object,
): CreatedRecord | undefined {
  const kind = KINDS[toolName];
  if (!kind) return undefined;
  if (kind === "status_report") {
    const parsed = statusReportOutput.safeParse(output);
    return parsed.success
      ? {
          kind,
          id: parsed.data.statusReport.id,
          label: parsed.data.statusReport.title,
        }
      : undefined;
  }
  const parsed = namedOutput.safeParse(output);
  return parsed.success
    ? { kind, id: parsed.data.id, label: parsed.data.title }
    : undefined;
}

const NOUNS: Record<CreatedRecord["kind"], string> = {
  status_report: "status report",
  incident: "managed incident",
  maintenance: "maintenance",
};

export function createdNote(records: CreatedRecord[]): string | undefined {
  if (!records.length) return undefined;
  const items = records.map(
    (r) => `${NOUNS[r.kind]} #${r.id}${r.label ? ` "${r.label}"` : ""}`,
  );
  return `Earlier in this thread, approved cards created or updated: ${items.join(", ")}. These exist now: use their ids only in subsequent tool calls, never show the ids in replies, and don't tell the user they don't exist.`;
}
