import type { PrivateLocation } from "@openstatus/db/src/schema";
import { getRegionInfo } from "@openstatus/regions";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@openstatus/ui/components/ui/tooltip";

import { cn } from "@/lib/utils";

export function TableCellRegion({
  value,
  privateLocations,
  variant = "location",
  className,
  ...props
}: React.ComponentProps<"div"> & {
  value: unknown;
  privateLocations?: PrivateLocation[];
  /** `"code"` trades the city name for the flag + region code, with the full name in a tooltip. */
  variant?: "location" | "code";
}) {
  if (typeof value !== "string" || value.length === 0) {
    return (
      <div className={cn("text-muted-foreground", className)} {...props}>
        -
      </div>
    );
  }
  const info = getRegionInfo(value, {
    location: privateLocations?.find((loc) => String(loc.id) === String(value))
      ?.name,
  });

  if (variant === "code") {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={cn("truncate", className)} {...props}>
              <span aria-hidden="true">{info.flag}</span>{" "}
              <span className="font-mono">{info.code}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>
              {info.location}{" "}
              <span className="text-muted-foreground">({info.provider})</span>
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div className={cn(className)} {...props}>
      {info.location}{" "}
      <span className="text-muted-foreground/70 text-xs">
        ({info.provider})
      </span>
    </div>
  );
}
