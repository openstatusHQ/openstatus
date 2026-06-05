import type { PrivateLocation } from "@openstatus/db/src/schema";
import { getRegionInfo } from "@openstatus/regions";

import { cn } from "@/lib/utils";

export function TableCellRegion({
  value,
  privateLocations,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  value: unknown;
  privateLocations?: PrivateLocation[];
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
  return (
    <div className={cn(className)} {...props}>
      {info.location}{" "}
      <span className="text-muted-foreground/70 text-xs">
        ({info.provider})
      </span>
    </div>
  );
}
