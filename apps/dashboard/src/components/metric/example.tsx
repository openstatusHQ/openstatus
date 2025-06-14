import {
  MetricCard,
  MetricCardBadge,
  MetricCardGroup,
  MetricCardHeader,
  MetricCardTitle,
  MetricCardValue,
} from "./metric-card";

const metrics = [
  {
    label: "UPTIME",
    value: "99.99%",
    trend: 1.01,
    variant: "success" as const,
  },
  {
    label: "FAILS",
    value: "0",
    variant: "destructive" as const,
  },
  {
    label: "DEGRADED",
    value: "0",
    trend: 0,
    variant: "warning" as const,
  },
  {
    label: "TOTAL PINGS",
    value: "8,639",
    trend: null,
    variant: "ghost" as const,
  },
  null,
  {
    label: "P50",
    value: "150ms",
    trend: 2,
    variant: "default" as const,
  },
  {
    label: "P75",
    value: "274ms",
    trend: 1,
    variant: "default" as const,
  },
  {
    label: "P90",
    value: "397ms",
    trend: 0.5,
    variant: "default" as const,
  },
  {
    label: "P95",
    value: "447ms",
    trend: 0.24,
    variant: "default" as const,
  },
  {
    label: "P99",
    value: "1,062ms",
    trend: 1.4,
    variant: "default" as const,
  },
];

export function MetricExample() {
  return (
    <MetricCardGroup>
      {metrics.map((metric) => {
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
