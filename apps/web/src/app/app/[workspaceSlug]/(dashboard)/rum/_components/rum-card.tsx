import { getColorByType, webVitalsConfig } from "@openstatus/rum";
import type { WebVitalEvents, WebVitalsValues } from "@openstatus/rum";
import { Card } from "@tremor/react";
import { CategoryBar } from "./category-bar";

export function prepareWebVitalValues(values: WebVitalsValues) {
  return values.map((value) => ({
    ...value,
    color: getColorByType(value.type),
  }));
}

export const RUMCard = async ({
  event,
  value,
}: {
  event: WebVitalEvents;
  value: number;
}) => {
  const eventConfig = webVitalsConfig[event];
  return (
    <Card>
      <p className="text-muted-foreground text-sm">
        {eventConfig.label} ({event})
      </p>
      <p className="font-semibold text-3xl text-foreground">
        {event !== "CLS" ? value.toFixed(0) : value.toFixed(2) || 0}
      </p>
      <CategoryBar
        values={prepareWebVitalValues(eventConfig.values)}
        marker={value || 0}
      />
    </Card>
  );
};
