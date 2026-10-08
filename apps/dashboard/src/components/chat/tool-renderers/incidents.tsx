import type {
  AgentToolInput,
  AgentToolOutput,
} from "@openstatus/services/agent-tools";

import type { ChangeRow } from "@/components/common/changes-table";
import { TableCellDate } from "@/components/data-table/table-cell-date";
import { TableCellNumber } from "@/components/data-table/table-cell-number";
import { TableCellText } from "@/components/data-table/table-cell-text";

import type { DetailsTableData } from "./details-table";
import type { ResultTableData } from "./result-table";

export function listIncidentsTable(
  output: AgentToolOutput<"list_incidents">,
): ResultTableData<"title" | "severity" | "status" | "commander" | "id"> {
  const items = output?.items ?? [];
  return {
    empty: "No incidents.",
    columns: [
      { key: "title", header: "Title" },
      { key: "severity", header: "Severity" },
      { key: "status", header: "Status" },
      { key: "commander", header: "Commander" },
      { key: "id", header: "ID" },
    ],
    rows: items.map((i) => ({
      id: i.id,
      cells: {
        title: <TableCellText value={i.title} />,
        severity: <TableCellText value={i.severity} />,
        status: (
          <TableCellText value={i.closed ? `${i.status} · closed` : i.status} />
        ),
        commander: <TableCellText value={i.commander?.name ?? null} />,
        id: <TableCellNumber value={i.id} />,
      },
    })),
  };
}

export function getIncidentDetails(
  output: AgentToolOutput<"get_incident">,
): DetailsTableData {
  return {
    sections: [
      {
        rows: [
          { label: "ID", value: <TableCellNumber value={output.id} /> },
          { label: "Title", value: <TableCellText value={output.title} /> },
          {
            label: "Severity",
            value: <TableCellText value={output.severity} />,
          },
          { label: "Status", value: <TableCellText value={output.status} /> },
          {
            label: "Commander",
            value: <TableCellText value={output.commander?.name ?? null} />,
          },
          {
            label: "Summary",
            value: <TableCellText value={output.summary} />,
          },
          {
            label: "Started",
            value: <TableCellDate value={new Date(output.startedAt)} />,
          },
          {
            label: "Status report",
            value: <TableCellText value={output.statusReport?.title ?? null} />,
          },
        ],
      },
      {
        title: "Timeline",
        rows: output.events.slice(0, 10).map((e) => ({
          label: e.type.replaceAll("_", " "),
          value: <TableCellText value={e.message} />,
        })),
      },
    ],
  };
}

export function declareIncidentChanges(
  input: AgentToolInput<"declare_incident">,
  result?: { id: number },
): ChangeRow[] {
  const changes: ChangeRow[] = [];
  if (result) changes.push({ field: "id", after: result.id });
  changes.push(
    { field: "title", after: input.title },
    { field: "severity", after: input.severity },
  );
  if (input.summary) changes.push({ field: "summary", after: input.summary });
  if (input.commanderId !== undefined) {
    changes.push({ field: "commanderId", after: input.commanderId });
  }
  if (input.startedAt) {
    changes.push({ field: "startedAt", after: input.startedAt });
  }
  if (input.statusReportId !== undefined) {
    changes.push({ field: "statusReportId", after: input.statusReportId });
  }
  return changes;
}

export function updateIncidentChanges(
  input: AgentToolInput<"update_incident">,
): ChangeRow[] {
  const changes: ChangeRow[] = [{ field: "incidentId", after: input.id }];
  for (const field of [
    "title",
    "severity",
    "summary",
    "commanderId",
    "startedAt",
  ] as const) {
    if (input[field] !== undefined) {
      changes.push({ field, after: input[field] });
    }
  }
  return changes;
}

export function resolveIncidentChanges(
  input: AgentToolInput<"resolve_incident">,
): ChangeRow[] {
  const changes: ChangeRow[] = [
    { field: "incidentId", after: input.id },
    { field: "status", after: "resolved" },
  ];
  if (input.note) changes.push({ field: "note", after: input.note });
  return changes;
}
