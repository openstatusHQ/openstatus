import type { AgentToolOutput } from "@openstatus/services/agent-tools";

import type { DetailsTableData } from "./details-table";

type Output = AgentToolOutput<"get_incident">;

export function getIncidentDetails(output: Output): DetailsTableData {
  return {
    sections: [
      {
        rows: [
          { label: "Title", value: output.title },
          { label: "Status", value: output.status },
          { label: "Severity", value: output.severity },
          { label: "Origin", value: output.origin },
          { label: "Started", value: output.startedAt },
          { label: "Last seen", value: output.lastSeenAt },
          { label: "Acknowledged", value: output.acknowledgedAt ?? "—" },
          { label: "Resolved", value: output.resolvedAt ?? "—" },
          {
            label: "Published",
            value:
              output.statusReportId === null
                ? "—"
                : `status report #${output.statusReportId}`,
          },
        ],
      },
    ],
  };
}
