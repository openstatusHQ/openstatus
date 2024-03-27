import type { Ping } from "@openstatus/tinybird";
import { Badge } from "@openstatus/ui";

import { cn } from "@/lib/utils";

export function DataTableStatusBadge({
  statusCode,
}: {
  statusCode: Ping["statusCode"];
}) {
  const isOk = String(statusCode).startsWith("2");
  return (
    <Badge
      variant="outline"
      className={cn(
        "px-2 py-0.5 text-xs",
        isOk
          ? "border-green-500/20 bg-green-500/10"
          : "border-red-500/20 bg-red-500/10",
      )}
    >
      {statusCode || "Error"}
      <div
        className={cn(
          "ml-1 h-1.5 w-1.5 rounded-full bg-foreground",
          isOk ? "bg-green-500" : "bg-red-500",
        )}
      />
    </Badge>
  );
}
