import { formatDistanceToNowStrict } from "date-fns";
import Link from "next/link";

import { periodFormatter } from "@/lib/monitor/utils";
import type { Period } from "@/lib/monitor/utils";
import type { ResponseTimeMetrics } from "@/lib/tb";
import { MetricsCard } from "./metrics-card";

const metricsOrder = [
  "p50Latency",
  "p75Latency",
  "p90Latency",
  "p95Latency",
  "p99Latency",
] as const;

export function Metrics({
  metrics,
  period,
  showErrorLink,
}: {
  metrics?: ResponseTimeMetrics[];
  period: Period;
  showErrorLink?: boolean;
}) {
  if (!metrics || metrics.length === 0) return null;

  const [current, last] = metrics.sort((a, b) =>
    (a.lastTimestamp || 0) - (b.lastTimestamp || 0) < 0 ? 1 : -1,
  );

  const isEmpty = current.count === 0;

  const uptime = isEmpty ? 1 : current.ok / current.count;
  const lastUptime = last.ok / last.count;

  const failures = current.count === 0 ? 0 : current.count - current.ok;
  const lastFailures = last.count - last.ok;

  const distance = current.lastTimestamp
    ? formatDistanceToNowStrict(new Date(current.lastTimestamp))
    : undefined;

  return (
    <div className="@container grid gap-6">
      <div className="grid @3xl:grid-cols-5 @xl:grid-cols-4 grid-cols-2 @3xl:gap-6 gap-4">
        <MetricsCard
          title="uptime"
          value={uptime * 100}
          suffix="%"
          delta={!isEmpty ? lastUptime / uptime : undefined}
          variant="positive"
        />
        <MetricsCard
          title="fails"
          value={failures}
          suffix="#"
          delta={
            !isEmpty
              ? lastFailures === 0
                ? 1
                : failures / lastFailures
              : undefined
          }
          variant="negative"
        />
        {distance ? (
          <MetricsCard
            title="last ping"
            value={Number.parseInt(distance.split(" ")[0])}
            suffix={`${distance.split(" ")[1]} ago`}
            variant="neutral"
          />
        ) : null}
        <MetricsCard title="total pings" value={current.count} suffix="#" />
      </div>
      <div className="grid gap-4">
        <div className="grid @3xl:grid-cols-5 @xl:grid-cols-4 grid-cols-2 @3xl:gap-6 gap-4">
          {metricsOrder.map((key) => {
            const value = current[key];
            const lastValue = last[key];
            const delta = value && lastValue ? value / lastValue : undefined;
            return (
              <MetricsCard
                key={key}
                title={key.replace("Latency", "")}
                value={value || 0}
                suffix="ms"
                delta={delta}
                fading={isEmpty}
              />
            );
          })}
        </div>
        <div className="grid gap-2">
          <p className="text-muted-foreground text-xs">
            Metrics calculated from the{" "}
            <span className="font-medium lowercase">
              {periodFormatter(period)}
            </span>{" "}
            over all the regions and compared with the previous period.
          </p>
          {/* restricted to max 3d as we only support it in the list -> TODO: add more periods */}
          {showErrorLink &&
          failures > 0 &&
          ["1h", "1d", "3d", "7d"].includes(period) ? (
            <p className="text-destructive text-xs">
              The monitor had {failures} failed ping(s). See more in the{" "}
              <Link
                href={`./data?error=true&period=${period}`}
                className="underline underline-offset-4 hover:no-underline"
              >
                response logs
              </Link>
              .
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
