import type { PageComponentImpact } from "@openstatus/db/src/schema/page_components/constants";

import { StatusDot } from "@/components/common/status-dot";
import {
  impactConfig,
  impactVariants,
} from "@/data/status-report-updates.client";

/** `impacts` omitted (maintenances) hides the label column. */
export function AffectedComponents({
  components,
  impacts,
  note,
}: {
  components: { id: number; name: string }[];
  impacts?: Map<number, PageComponentImpact>;
  note?: React.ReactNode;
}) {
  if (components.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">No components affected.</p>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2 text-sm">
        {components.map((component) => {
          const impact = impacts?.get(component.id);
          return (
            <li
              key={component.id}
              className="flex items-center justify-between gap-3"
            >
              <span className="flex min-w-0 items-center gap-2">
                <StatusDot
                  variant={impact ? impactVariants[impact] : "default"}
                />
                <span className="truncate font-mono">{component.name}</span>
              </span>
              {impacts ? (
                <span className="text-muted-foreground shrink-0 font-mono text-xs uppercase">
                  {impact ? impactConfig[impact].label : "Untriaged"}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
      {note ? <p className="text-muted-foreground text-sm">{note}</p> : null}
    </div>
  );
}
