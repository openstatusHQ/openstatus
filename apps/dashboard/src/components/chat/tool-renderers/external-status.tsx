import type { AgentToolOutput } from "@openstatus/services/agent-tools";

import { TableCellLink } from "@/components/data-table/table-cell-link";
import { TableCellText } from "@/components/data-table/table-cell-text";

import type { DetailsTableData } from "./details-table";
import type { ResultTableData } from "./result-table";

type StatusOutput = AgentToolOutput<"get_service_status">;
type IssuesOutput = AgentToolOutput<"list_active_issues">;

const STATUS_TEXT: Record<StatusOutput["status"], string> = {
  operational: "Operational",
  minor_issue: "Minor issue",
  partial_outage: "Partial outage",
  major_outage: "Major outage",
  maintenance: "Maintenance",
  unknown: "Unknown",
};

export function statusText(status: StatusOutput["status"]): string {
  return STATUS_TEXT[status] ?? status;
}

export function getServiceStatusDetails(
  output: StatusOutput,
): DetailsTableData {
  if (!output.found || !output.service) {
    return {
      sections: [],
      empty: output.suggestions.length
        ? `${output.verdict} Did you mean: ${output.suggestions.map((s) => s.name).join(", ")}?`
        : output.verdict,
    };
  }
  const { service, component } = output;
  return {
    sections: [
      {
        rows: [
          {
            label: "Service",
            value: <TableCellLink href={service.url} value={service.name} />,
          },
          ...(component
            ? [
                {
                  label: "Component",
                  value: (
                    <TableCellLink
                      href={component.url}
                      value={component.name}
                    />
                  ),
                },
              ]
            : []),
          {
            label: "Status",
            value: (
              <TableCellText
                value={`${statusText(output.status)}${output.stale ? " (stale)" : ""}`}
              />
            ),
          },
          { label: "Verdict", value: <TableCellText value={output.verdict} /> },
          {
            label: "Affected",
            value: (
              <TableCellText
                value={
                  output.affectedComponentCount > 0
                    ? output.affectedComponents.map((c) => c.name).join(", ")
                    : "—"
                }
              />
            ),
          },
          {
            label: "Open incidents",
            value: (
              <TableCellText
                value={
                  output.activeIncidents.length > 0
                    ? output.activeIncidents.map((i) => i.title).join(", ")
                    : "—"
                }
              />
            ),
          },
        ],
      },
    ],
  };
}

export function listActiveIssuesTable(
  output: IssuesOutput,
): ResultTableData<"name" | "status" | "message"> {
  const issues = output?.issues ?? [];
  return {
    empty: "No tracked service reports a problem right now.",
    columns: [
      { key: "name", header: "Service" },
      { key: "status", header: "Status" },
      { key: "message", header: "Message" },
    ],
    rows: issues.map((i) => ({
      id: i.slug,
      cells: {
        name: <TableCellLink href={i.url} value={i.name} />,
        status: <TableCellText value={statusText(i.status)} />,
        message: (
          <TableCellText
            value={i.providerMessage ?? "—"}
            className="text-muted-foreground"
          />
        ),
      },
    })),
  };
}
