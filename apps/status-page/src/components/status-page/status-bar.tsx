"use client";

import { Link } from "@/components/common/link";
import { usePathnamePrefix } from "@/hooks/use-pathname-prefix";
import {
  StatusBar as BlockStatusBar,
  StatusBarEvent,
} from "@openstatus/ui/components/blocks/status-bar";

export { StatusBarSkeleton } from "@openstatus/ui/components/blocks/status-bar";

/**
 * StatusBar — wrapper that wires Next.js `<Link>` (with locale/slug prefix)
 * around report/maintenance event badges in the hover card. Incidents stay
 * unwrapped (no detail page).
 */
export function StatusBar(
  props: Omit<React.ComponentProps<typeof BlockStatusBar>, "renderEvent">,
) {
  const prefix = usePathnamePrefix();
  return (
    <BlockStatusBar
      renderEvent={(event, index) => {
        const node = (
          <StatusBarEvent
            key={`${event.id}-${event.type}-${index}`}
            type={event.type}
            name={event.name}
            from={event.from}
            to={event.to}
            isAggregated={event.isAggregated}
          />
        );
        if (event.type === "report" || event.type === "maintenance") {
          return (
            <Link
              variant="unstyled"
              key={`${event.id}-${event.type}-${index}`}
              href={`${prefix ? `/${prefix}` : ""}/events/${event.type}/${event.id}`}
            >
              {node}
            </Link>
          );
        }
        return node;
      }}
      {...props}
    />
  );
}
