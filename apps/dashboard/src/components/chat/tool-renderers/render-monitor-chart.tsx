import { Trend } from "@openstatus/icons";
import type { AgentToolOutput } from "@openstatus/services/agent-tools";
import { ChartLatencyRegions } from "@openstatus/ui/components/custom/chart-latency-regions";

import { ChartEmpty } from "@/components/chart/chart-empty";
import { EntityRef } from "@/components/common/entity-ref/entity-ref";
import {
  EmptyStateMedia,
  EmptyStateTitle,
} from "@/components/content/empty-state";
import { formatDateTime } from "@/lib/formatter";

type Output = AgentToolOutput<"render_monitor_chart">;

export function renderMonitorChartSummary(output: Output): string {
  const window = `${output.percentile} · last ${output.timeRange}`;
  return output.peak
    ? `${window} · peak ${output.peak.value}ms in ${output.peak.region}`
    : `${window} · ${output.timestamps.length === 0 ? "no checks" : "no latency"}`;
}

export function MonitorChartResult({ output }: { output: Output }) {
  return (
    <div className="space-y-2 text-sm">
      <p className="text-muted-foreground">
        <EntityRef kind="monitor" id={output.monitorId}>
          {output.name}
        </EntityRef>
        {output.peak ? (
          <>
            {" · peak "}
            <span className="text-foreground font-medium">
              {output.peak.value}ms
            </span>
            {` in ${output.peak.region} at ${formatDateTime(new Date(output.peak.timestamp))}`}
          </>
        ) : null}
      </p>
      <ChartLatencyRegions
        timestamps={output.timestamps}
        series={output.series}
        timeRange={output.timeRange}
        intervalMinutes={output.intervalMinutes}
        renderEmpty={(_, text) => (
          <ChartEmpty>
            <EmptyStateMedia>
              <Trend />
            </EmptyStateMedia>
            <EmptyStateTitle>{text}</EmptyStateTitle>
          </ChartEmpty>
        )}
      />
      {output.omittedRegions.length > 0 ? (
        <p className="text-muted-foreground text-xs">
          Showing the {output.series.length} slowest regions. Not plotted:{" "}
          {output.omittedRegions.join(", ")}.
        </p>
      ) : null}
    </div>
  );
}
