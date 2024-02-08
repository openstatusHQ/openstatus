import { formatDistanceToNowStrict } from "date-fns";

import type { LatencyMetric, ResponseTimeMetrics } from "@openstatus/tinybird";

import { periodFormatter } from "../utils";
import type { Period } from "../utils";
import { MetricsCard } from "./metrics-card";

const metricsOrder = [
  "avgLatency",
  "p75Latency",
  "p90Latency",
  "p95Latency",
  "p99Latency",
] satisfies LatencyMetric[];

export function Metrics({
  metrics,
  period,
}: {
  metrics?: ResponseTimeMetrics[];
  period: Period;
}) {
  if (!metrics) return null;

  const [current, last] = metrics.sort((a, b) =>
    a.time - b.time < 0 ? 1 : -1,
  );

  const uptime = current.ok / current.count;
  const lastUptime = last.ok / last.count;

  const failures = current.count - current.ok;
  const lastFailures = last.count - last.ok;

  console.log(metrics);

  const distance = current.lastTimestamp
    ? formatDistanceToNowStrict(new Date(current.lastTimestamp))
    : undefined;

  return (
    <div className="grid gap-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 md:grid-cols-5 md:gap-6">
        <MetricsCard
          title="uptime"
          value={uptime * 100}
          suffix="%"
          delta={lastUptime / uptime}
          variant="positive"
        />
        <MetricsCard
          title="fails"
          value={failures}
          suffix="#"
          delta={failures === 0 ? 1 : lastFailures / failures}
          variant="negative"
        />
        {distance ? (
          <MetricsCard
            title="last ping"
            value={parseInt(distance.split(" ")[0])}
            suffix={`${distance.split(" ")[1]} ago`}
            variant="neutral"
          />
        ) : null}
        <MetricsCard title="total pings" value={current.count} suffix="#" />
      </div>
      <div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 md:grid-cols-5 md:gap-6">
          {metricsOrder.map((key) => {
            const value = current[key];
            const lastValue = last[key];
            const delta = lastValue / value;
            return (
              <MetricsCard
                key={key}
                title={key.replace("Latency", "")}
                value={value}
                suffix="ms"
                delta={delta}
              />
            );
          })}
        </div>
        <p className="text-muted-foreground mt-4 text-xs">
          Metrics calculated from the{" "}
          <span className="font-medium lowercase">
            {periodFormatter(period)}
          </span>{" "}
          over all the regions and compared with the previous period.
        </p>
      </div>
    </div>
  );
}
