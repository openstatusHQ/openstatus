import { Badge } from "@openstatus/ui";

import { cn } from "@/lib/utils";

export function StatusBadge({ statusCode }: { statusCode: number }) {
  const green = String(statusCode).startsWith("2");
  const blue = String(statusCode).startsWith("3");
  const rose =
    String(statusCode).startsWith("4") || String(statusCode).startsWith("5");
  return (
    <Badge
      variant="outline"
      className={cn("font-mono", {
        "border-green-500/20 bg-green-500/10 text-green-800 dark:text-green-300":
          green,
        "border-blue-500/20 bg-blue-500/10 text-blue-800 dark:text-blue-300":
          blue,
        "border-rose-500/20 bg-rose-500/10 text-rose-800 dark:text-rose-300":
          rose,
      })}
    >
      {statusCode}
    </Badge>
  );
}
