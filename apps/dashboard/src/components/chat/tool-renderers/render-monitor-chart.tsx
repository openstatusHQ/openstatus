import type { AgentToolOutput } from "@openstatus/services/agent-tools";

import { ChartLineLatencyRegions } from "@/components/chart/chart-line-latency-regions";
import { EntityRef } from "@/components/common/entity-ref/entity-ref";
import { formatDateTime } from "@/lib/formatter";

type Output = AgentToolOutput<"render_monitor_chart">;

export function renderMonitorChartSummary(output: Output): string {
  const window = `${output.percentile} · last ${output.timeRange}`;
  return output.peak
    ? `${window} · peak ${output.peak.value}ms in ${output.peak.region}`
    : `${window} · no checks`;
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
      <ChartLineLatencyRegions
        timestamps={output.timestamps}
        series={output.series}
        period={output.timeRange}
        intervalMinutes={output.intervalMinutes}
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
