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
          "border-rose-500/20 bg-rose-500/10 text-rose-500":
            status === "investigating",
          "border-amber-500/20 bg-amber-500/10 text-amber-500":
            status === "identified",
          "border-blue-500/20 bg-blue-500/10 text-blue-500":
            status === "monitoring",
          "border-green-500/20 bg-green-500/10 text-green-500":
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
