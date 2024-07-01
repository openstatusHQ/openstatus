"use client";

import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@openstatus/ui";
import { format } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { useState } from "react";

export function DateTimeTooltip({
  date = new Date(),
  className,
}: {
  date?: Date;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <TooltipProvider>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger
          onClick={() => setOpen(false)}
          className={cn(
            "text-muted-foreground underline decoration-muted-foreground/30 decoration-dashed underline-offset-4",
            className
          )}
          asChild
        >
          <span>{formatInTimeZone(date, "UTC", "LLL dd, y HH:mm (z)")}</span>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-muted-foreground text-xs">
            {format(date, "LLL dd, y HH:mm (z)")}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
