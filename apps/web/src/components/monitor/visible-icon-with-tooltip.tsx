import { Eye, EyeOff } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@openstatus/ui";

export function VisibleIconWithTooltip({ visible }: { visible: boolean }) {
  return (
    <TooltipProvider>
      <Tooltip delayDuration={200}>
        <TooltipTrigger>
          {visible ? (
            <Eye className="text-muted-foreground hover:text-foreground h-4 w-4" />
          ) : (
            <EyeOff className="text-muted-foreground hover:text-foreground h-4 w-4" />
          )}
        </TooltipTrigger>
        <TooltipContent side="top">
          Monitor is {visible ? "public" : "private"}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
