import type { Trigger } from "@/lib/monitor/utils";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@openstatus/ui/src/components/tooltip";

import { type IconProps, Icons } from "@/components/icons";
import { triggerDict } from "@/data/trigger-dictionary";

interface TriggerIconWithTooltipProps extends IconProps {
  triggerType: Trigger;
}

export function TriggerIconWithTooltip({
  triggerType,
  className,
  ...props
}: TriggerIconWithTooltipProps) {
  const config = triggerDict[triggerType];
  const Icon = Icons[config.icon];
  return (
    <TooltipProvider delayDuration={50}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Icon className={cn("h-4 w-4", className)} {...props} />
        </TooltipTrigger>
        <TooltipContent>
          <p>{config.label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
