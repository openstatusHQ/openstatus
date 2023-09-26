import { Badge } from "@openstatus/ui";

import { statusDict } from "@/data/incidents-dictionary";
import { cn } from "@/lib/utils";
import { Icons } from "../icons";

export function StatusBadge({
  status,
  className,
}: {
  status: keyof typeof statusDict;
  className?: string;
}) {
  const { label, icon } = statusDict[status];
  const Icon = Icons[icon];
  return (
    <Badge
      variant="outline"
      className={cn(
        "font-normal",
        {
          "border-red-600/20 bg-red-50 text-red-600":
            status === "investigating",
          "border-yellow-600/20 bg-yellow-50 text-yellow-600":
            status === "identified",
          "border-blue-600/20 bg-blue-50 text-blue-600":
            status === "monitoring",
          "border-green-600/20 bg-green-50 text-green-600":
            status === "resolved",
        },
        className,
      )}
    >
      <Icon className="mr-1 h-3 w-3" />
      {label}
    </Badge>
  );
}
