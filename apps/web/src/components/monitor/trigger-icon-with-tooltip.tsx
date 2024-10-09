import type { Trigger } from "@/lib/monitor/utils";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@openstatus/ui/src/components/tooltip";
import { type IconProps, Icons, type ValidIcon } from "../icons";

function getIcon(type: Trigger): ValidIcon {
  switch (type) {
    case "cron":
      return "clock";
    case "api":
      return "network";
    default:
      return "cog";
  }
}

interface TriggerIconWithTooltipProps extends IconProps {
  triggerType: Trigger;
}

export function TriggerIconWithTooltip({
  triggerType,
  className,
  ...props
}: TriggerIconWithTooltipProps) {
  const icon = getIcon(triggerType);
  const Icon = Icons[icon];
  return (
    <TooltipProvider delayDuration={50}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Icon className={cn("h-4 w-4", className)} {...props} />
        </TooltipTrigger>
        <TooltipContent>
          <p className="uppercase">{triggerType}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
