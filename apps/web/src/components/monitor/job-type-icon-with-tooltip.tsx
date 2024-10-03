import { cn } from "@/lib/utils";
import type { Monitor } from "@openstatus/db/src/schema";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@openstatus/ui/src/components/tooltip";
import { type IconProps, Icons, type ValidIcon } from "../icons";

// TODO: extend once we have more job types
function getIcon(jobType: Monitor["jobType"]): ValidIcon {
  switch (jobType) {
    case "http":
      return "globe";
    case "tcp":
      return "server";
    default:
      return "cog";
  }
}

interface JobTypeIconWithTooltipProps extends IconProps {
  jobType: Monitor["jobType"];
}

export function JobTypeIconWithTooltip({
  jobType,
  className,
  ...props
}: JobTypeIconWithTooltipProps) {
  const icon = getIcon(jobType);
  const Icon = Icons[icon];
  return (
    <TooltipProvider delayDuration={50}>
      <Tooltip>
        <TooltipTrigger>
          <Icon className={cn("h-3 w-3", className)} {...props} />
        </TooltipTrigger>
        <TooltipContent>
          <p className="uppercase">{jobType}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
