import { Eye, EyeOff } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@openstatus/ui/src/components/tooltip";

export function VisibleIconWithTooltip({ visible }: { visible: boolean }) {
  return (
    <TooltipProvider>
      <Tooltip delayDuration={200}>
        <TooltipTrigger>
          {visible ? (
            <Eye className="h-4 w-4 text-muted-foreground hover:text-foreground" />
          ) : (
            <EyeOff className="h-4 w-4 text-muted-foreground hover:text-foreground" />
          )}
        </TooltipTrigger>
        <TooltipContent side="top">
          Monitor is {visible ? "public" : "private"}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
