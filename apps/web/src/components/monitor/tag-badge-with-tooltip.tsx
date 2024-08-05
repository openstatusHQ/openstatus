import type { MonitorTag } from "@openstatus/db/src/schema";
import { Badge } from "@openstatus/ui/src/components/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@openstatus/ui/src/components/tooltip";

import { TagBadge } from "./tag-badge";

export function TagBadgeWithTooltip({ tags }: { tags?: MonitorTag[] }) {
  const [first, second, ...rest] = tags || [];
  return (
    <div className="flex items-center gap-2">
      {first ? <TagBadge {...first} /> : null}
      {second ? <TagBadge {...second} /> : null}
      {rest.length > 0 ? (
        <TooltipProvider>
          <Tooltip delayDuration={200}>
            <TooltipTrigger>
              <Badge variant="secondary" className="border">
                +{rest.length}
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="top" className="flex gap-2">
              {rest.map((tag) => (
                <TagBadge key={tag.id} {...tag} />
              ))}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : null}
    </div>
  );
}
