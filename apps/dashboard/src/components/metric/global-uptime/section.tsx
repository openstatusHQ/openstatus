import {
  MetricCard,
  MetricCardBadge,
  MetricCardGroup,
  MetricCardHeader,
  MetricCardTitle,
  MetricCardValue,
} from "@/components/metric/metric-card";

type Metric = {
  label: string;
  value: string;
  trend?: number | null;
  variant: React.ComponentProps<typeof MetricCard>["variant"];
};

export function GlobalUptimeSection({
  metrics,
}: {
  metrics: (Metric | null)[];
}) {
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
