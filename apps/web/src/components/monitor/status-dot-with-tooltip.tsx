import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@openstatus/ui";

import type { StatusDotProps } from "./status-dot";
import { StatusDot } from "./status-dot";

export interface StatusDotWithTooltipProps extends StatusDotProps {}

export function StatusDotWithTooltip(props: StatusDotWithTooltipProps) {
  const { active, maintenance, status } = props;
  return (
    <TooltipProvider delayDuration={50}>
      <Tooltip>
        <TooltipTrigger>
          <StatusDot {...props} />
        </TooltipTrigger>
        <TooltipContent>
          {(() => {
            if (!active) return "Monitor is inactive";
            if (maintenance) return "Monitor in maintenance";
            if (status === "error") return "Monitor has failed";
            return "Monitor is active";
          })()}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
