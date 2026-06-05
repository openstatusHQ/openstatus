import type {
  AgentToolInput,
  AgentToolOutput,
} from "@openstatus/services/agent-tools";

import { TableCellBoolean } from "@/components/data-table/table-cell-boolean";
import { TableCellDate } from "@/components/data-table/table-cell-date";
import { TableCellNumber } from "@/components/data-table/table-cell-number";
import { TableCellRegion } from "@/components/data-table/table-cell-region";
import { TableCellText } from "@/components/data-table/table-cell-text";

import type {
  DetailsRow,
  DetailsSection,
  DetailsTableData,
} from "./details-table";

type Input = AgentToolInput<"get_response_log">;
type Output = AgentToolOutput<"get_response_log">;
type Timing = NonNullable<Output["timing"]>;

export function getResponseLogDetails(
  _input: Input,
  output: Output,
): DetailsTableData {
  const request: DetailsRow[] = [
    { label: "Log ID", value: <TableCellText value={output.id} /> },
    { label: "Monitor", value: <TableCellText value={output.monitorId} /> },
    { label: "Region", value: <TableCellRegion value={output.region} /> },
    { label: "URL", value: <TableCellText value={output.url} /> },
    {
      label: "Status",
      value: <TableCellText value={output.requestStatus} />,
    },
    {
      label: "Status code",
      value: <TableCellNumber value={output.statusCode} />,
    },
    {
      label: "Latency",
      value: <TableCellNumber value={output.latency} unit="ms" />,
    },
    {
      label: "Timestamp",
      value: <TableCellDate value={new Date(output.timestamp)} />,
    },
    { label: "Trigger", value: <TableCellText value={output.trigger} /> },
    { label: "Error", value: <TableCellBoolean value={output.error} /> },
  ];

  const sections: DetailsSection[] = [{ rows: request }];

  if (Object.keys(output.headers).length > 0) {
    sections.push({
      rows: [
        {
          label: "Headers",
          value: (
            <pre className="whitespace-pre-wrap break-all text-foreground">
              {JSON.stringify(output.headers, null, 2)}
            </pre>
          ),
        },
      ],
    });
  }

  if (output.timing) {
    sections.push({
      rows: timingRows(output.timing, output.latency),
    });
  }

  if (output.message) {
    sections.push({
      rows: [
        { label: "Message", value: <TableCellText value={output.message} /> },
      ],
    });
  }

  if (output.assertions) {
    sections.push({
      rows: [
        {
          label: "Assertions",
          value: <TableCellText value={output.assertions} />,
        },
      ],
    });
  }

  return { sections };
}

function timingRows(timing: Timing, latency: number): DetailsRow[] {
  const denom = latency || 1;
  return Object.entries(timing).map(([key, value], index) => ({
    label: key.toUpperCase(),
    value: (
      <div className="flex items-center justify-between gap-3">
        <span className="text-muted-foreground">
          {new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(
            (value / denom) * 100,
          )}
          %
        </span>
        <div className="flex flex-1 items-center justify-end gap-1">
          <span className="text-nowrap text-muted-foreground">{value} ms</span>
          <div
            className="h-3"
            style={{
              width: `${(value / denom) * 100}%`,
              backgroundColor: `var(--chart-${index + 1})`,
            }}
          />
        </div>
      </div>
    ),
  }));
}
