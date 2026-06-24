import { StatusBarEvent } from "@openstatus/ui/components/blocks/status-bar";
import type { StatusBarData } from "@openstatus/ui/components/blocks/status.types";
import { cn } from "@openstatus/ui/lib/utils";

export function renderIncidentEvent(
  event: StatusBarData["events"][number],
  index: number,
) {
  const key = `${event.id}-${event.type}-${index}`;
  const spacing = index > 0 ? "mt-2" : undefined;
  const node = (
    <StatusBarEvent
      type={event.type}
      name={event.name}
      from={event.from}
      to={event.to}
      isAggregated={event.isAggregated}
      status={event.status}
    />
  );
  if (!event.shortlink)
    return (
      <div key={key} className={spacing}>
        {node}
      </div>
    );
  return (
    <a
      key={key}
      className={cn("block", spacing)}
      href={event.shortlink}
      target="_blank"
      rel="noopener noreferrer"
    >
      {node}
    </a>
  );
}
