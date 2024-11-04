import type { Notification } from "@openstatus/db/src/schema";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@openstatus/ui/src/components/tooltip";

import { Bell, BellOff } from "lucide-react";

export function NotificationIconWithTooltip({
  notifications,
}: {
  notifications?: Notification[];
}) {
  return (
    <TooltipProvider>
      <Tooltip delayDuration={200}>
        <TooltipTrigger className="text-muted-foreground">
          {notifications?.length ? (
            <Bell className="h-4 w-4" />
          ) : (
            <BellOff className="h-4 w-4" />
          )}
        </TooltipTrigger>
        <TooltipContent side="top" className="flex gap-2">
          {`${notifications?.length || "No"} notification channels`}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
