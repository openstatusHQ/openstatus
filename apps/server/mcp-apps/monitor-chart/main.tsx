import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { MonitorChartModel } from "@openstatus/services/agent-tools";
import { ChartLatencyRegions } from "@openstatus/ui/components/custom/chart-latency-regions";
import { Button } from "@openstatus/ui/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@openstatus/ui/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@openstatus/ui/components/ui/tabs";
import {
  type ChartLocale,
  formatChartDateTime,
} from "@openstatus/ui/lib/chart-latency";
import { cn } from "@openstatus/ui/lib/utils";
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

import { callTool, resultText, useHost } from "../_shared/use-host";

const TOOL_NAME = "render_monitor_chart";
const TIME_RANGES = ["1d", "7d", "14d"] as const;
const PERCENTILES = ["p50", "p75", "p90", "p95", "p99"] as const;

type Range = MonitorChartModel["timeRange"];
type Percentile = MonitorChartModel["percentile"];

// The tool's `outputSchema` is the contract; this only guards a foreign payload.
function isChartModel(value: unknown): value is MonitorChartModel {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<MonitorChartModel>;
  return (
    typeof candidate.monitorId === "number" &&
    Array.isArray(candidate.timestamps) &&
    Array.isArray(candidate.series)
  );
}

function formatInterval(minutes: number): string {
  return minutes % 60 === 0 ? `${minutes / 60}h` : `${minutes}min`;
}

function MonitorChartView() {
  const {
    app,
    error: hostError,
    result,
    capabilities,
    locale,
  } = useHost("openstatus-monitor-chart");
  const [model, setModel] = useState<MonitorChartModel>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(true);
  const [showTable, setShowTable] = useState(false);

  const apply = (next: CallToolResult) => {
    if (next.isError) {
      setError(resultText(next) || "The chart could not be loaded.");
    } else if (isChartModel(next.structuredContent)) {
      setError(undefined);
      setModel(next.structuredContent);
    } else {
      setError("The server returned no chart data.");
    }
    setBusy(false);
  };

  useEffect(() => {
    if (result === "cancelled") {
      setError("The chart request was cancelled.");
      setBusy(false);
    } else if (result) {
      apply(result);
    }
  }, [result]);

  useEffect(() => {
    if (hostError) {
      setError(hostError.message);
      setBusy(false);
    }
  }, [hostError]);

  const refetch = async (next: {
    timeRange?: Range;
    percentile?: Percentile;
  }) => {
    if (!app || !model) return;
    const regions = model.series.map((s) => s.region);
    setBusy(true);
    try {
      const response = await callTool(app, TOOL_NAME, {
        monitorId: model.monitorId,
        timeRange: next.timeRange ?? model.timeRange,
        percentile: next.percentile ?? model.percentile,
        // pin the regions so a line keeps its colour across ranges
        ...(regions.length > 0 ? { regions } : {}),
      });
      apply(response);
      if (!response.isError && capabilities?.updateModelContext) {
        // keeps the model's picture in step with what the user now sees
        await app
          .updateModelContext({ content: response.content })
          .catch(() => {});
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "The chart could not be loaded.",
      );
      setBusy(false);
    }
  };

  const regionCount = model?.series.length ?? 0;
  const canRefetch = Boolean(capabilities?.serverTools);

  return (
    <main
      aria-busy={busy}
      className="bg-background text-foreground space-y-3 p-4 text-sm"
    >
      <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div>
          <h1 className="font-semibold">
            {model ? `${model.percentile} latency · ${model.name}` : "Latency"}
          </h1>
          <p className="text-muted-foreground text-xs">
            {model
              ? [
                  model.jobType.toUpperCase(),
                  `last ${model.timeRange}`,
                  `${formatInterval(model.intervalMinutes)} buckets`,
                  `${regionCount} ${regionCount === 1 ? "region" : "regions"}`,
                ].join(" · ")
              : "Loading…"}
          </p>
        </div>
        {model ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {canRefetch ? (
              <>
                <Tabs
                  value={model.timeRange}
                  onValueChange={(value) =>
                    void refetch({ timeRange: value as Range })
                  }
                >
                  <TabsList aria-label="Time range">
                    {TIME_RANGES.map((range) => (
                      <TabsTrigger key={range} value={range} disabled={busy}>
                        {range}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
                <Tabs
                  value={model.percentile}
                  onValueChange={(value) =>
                    void refetch({ percentile: value as Percentile })
                  }
                >
                  <TabsList aria-label="Percentile">
                    {PERCENTILES.map((value) => (
                      <TabsTrigger key={value} value={value} disabled={busy}>
                        {value}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              </>
            ) : null}
            <Button
              size="sm"
              variant={showTable ? "secondary" : "outline"}
              aria-pressed={showTable}
              onClick={() => setShowTable((value) => !value)}
            >
              Table
            </Button>
            {capabilities?.openLinks ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  void app
                    ?.openLink({ url: model.dashboardUrl })
                    .catch(() => {})
                }
              >
                Open in openstatus
              </Button>
            ) : null}
          </div>
        ) : null}
      </header>

      {model?.peak ? (
        <p className="text-muted-foreground text-xs">
          Peak{" "}
          <span className="text-foreground font-medium">
            {model.peak.value.toLocaleString(locale.locale)} ms
          </span>{" "}
          in {model.peak.region} at{" "}
          {formatChartDateTime(model.peak.timestamp, locale)}
        </p>
      ) : null}

      {model ? (
        <div className={cn("transition-opacity", busy && "opacity-50")}>
          {showTable ? (
            <LatencyTable model={model} locale={locale} />
          ) : (
            <ChartLatencyRegions
              timestamps={model.timestamps}
              series={model.series}
              timeRange={model.timeRange}
              intervalMinutes={model.intervalMinutes}
              locale={locale}
            />
          )}
        </div>
      ) : null}

      {model && model.omittedRegions.length > 0 ? (
        <p className="text-muted-foreground text-xs">
          Showing the {regionCount} slowest regions. Not plotted:{" "}
          {model.omittedRegions.join(", ")}.
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      ) : null}
    </main>
  );
}

function LatencyTable({
  model,
  locale,
}: {
  model: MonitorChartModel;
  locale: ChartLocale;
}) {
  // newest first, like the response log
  const rows = model.timestamps
    .map((timestamp, index) => ({ timestamp, index }))
    .reverse();
  return (
    <div className="max-h-72 overflow-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Time</TableHead>
            {model.series.map((s) => (
              <TableHead key={s.region} className="text-right">
                {s.region} (ms)
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(({ timestamp, index }) => (
            <TableRow key={timestamp}>
              <TableCell>{formatChartDateTime(timestamp, locale)}</TableCell>
              {model.series.map((s) => {
                const value = s.values[index] ?? null;
                return (
                  <TableCell
                    key={s.region}
                    className="text-right font-mono tabular-nums"
                  >
                    {value === null ? "–" : value.toLocaleString(locale.locale)}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("#root is missing from the view");
createRoot(root).render(<MonitorChartView />);
