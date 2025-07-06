"use client";

import {
  MetricCard,
  MetricCardBadge,
  MetricCardGroup,
  MetricCardHeader,
  MetricCardSkeleton,
  MetricCardTitle,
  MetricCardValue,
} from "@/components/metric/metric-card";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery } from "@tanstack/react-query";

import { mapMetrics, metricsCards } from "@/data/metrics.client";
import {
  formatMilliseconds,
  formatNumber,
  formatPercentage,
} from "@/lib/formatter";
import { flyRegions } from "@openstatus/db/src/schema/constants";

type Metric = {
  label: string;
  value: string;
  trend?: number | null;
  variant: React.ComponentProps<typeof MetricCard>["variant"];
};

// TODO: move the fetch to the parent component
// TODO: missing dynamic degraded

export function GlobalUptimeSection({
  monitorId,
  jobType,
  period = "7d",
  regions,
}: {
  monitorId: string;
  jobType: "http" | "tcp";
  period: "1d" | "7d" | "14d";
  regions: (typeof flyRegions)[number][];
}) {
  const trpc = useTRPC();

  const { data: metrics, isLoading } = useQuery(
    trpc.tinybird.metrics.queryOptions({
      monitorId,
      period,
      type: jobType,
      regions,
    })
  );

  // Helper to transform the data the same way it used to be in the page
  function defineMetrics() {
    if (!metrics) return null;
    const _metrics = mapMetrics(metrics);

    if (_metrics.length !== 2) return null;

    return _metrics.reverse().reduce(
      (acc, metric) => {
        Object.entries(metric).forEach(([key, value]) => {
          const k = key as keyof typeof acc;
          const isPercentage = k.startsWith("p");
          const isUptime = k === "uptime";
          const v = isUptime
            ? formatPercentage(value ?? 0)
            : isPercentage
              ? formatMilliseconds(value ?? 0)
              : formatNumber(value ?? 0);

          if (k in acc) {
            const trend = acc[k]?.raw ? (value ?? 0) / acc[k]?.raw : 1;
            const hasTrend =
              !isNaN(trend) && trend !== Infinity && k !== "total";
            acc[k] = {
              label: metricsCards[k].label,
              variant: metricsCards[k].variant,
              value: v ?? "0",
              trend: hasTrend ? trend : null,
              raw: value ?? 0,
            } as (typeof acc)[typeof k & keyof typeof acc];
          } else {
            acc[k] = {
              label: metricsCards[k].label,
              variant: metricsCards[k].variant,
              value: v ?? "0",
              trend: 1,
              raw: value ?? 0,
            } as (typeof acc)[typeof k & keyof typeof acc];
          }
        });
        return acc;
      },
      {} as Record<
        keyof ReturnType<typeof mapMetrics>[number],
        Metric & { raw: number }
      >
    );
  }

  const refinedMetrics: (Metric | null)[] = (
    [
      "uptime",
      "degraded",
      "error",
      "total",
      null,
      "p50",
      "p75",
      "p90",
      "p95",
      "p99",
    ] as const
  ).map((key) => {
    if (!key) return null;
    const metric =
      defineMetrics()?.[key as keyof ReturnType<typeof mapMetrics>[number]];
    return {
      label: metricsCards[key].label,
      value: metric?.value ?? "0",
      trend: metric?.trend ?? null,
      variant: metricsCards[key].variant,
    } as Metric;
  });

  // TODO: rework, might be removed and simply add a condition on the other return
  if (isLoading) {
    return (
      <MetricCardGroup>
        {refinedMetrics.map((metric) => {
          if (metric === null)
            return <div key={metric} className="hidden lg:block" />;
          return (
            <MetricCard key={metric.label} variant={metric.variant}>
              <MetricCardHeader>
                <MetricCardTitle className="truncate">
                  {metric.label}
                </MetricCardTitle>
              </MetricCardHeader>
              <MetricCardSkeleton className="h-6 w-12" />
            </MetricCard>
          );
        })}
      </MetricCardGroup>
    );
  }

  return (
    <MetricCardGroup>
      {refinedMetrics.map((metric) => {
        if (metric === null)
          return <div key={metric} className="hidden lg:block" />;
        return (
          <MetricCard key={metric.label} variant={metric.variant}>
            <MetricCardHeader>
              <MetricCardTitle className="truncate">
                {metric.label}
              </MetricCardTitle>
            </MetricCardHeader>
            <div className="flex flex-row flex-wrap items-center gap-1.5">
              <MetricCardValue>{metric.value}</MetricCardValue>
              {metric.trend ? <MetricCardBadge value={metric.trend} /> : null}
            </div>
          </MetricCard>
        );
      })}
    </MetricCardGroup>
  );
}
