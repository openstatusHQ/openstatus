import type { StatusReport } from "@openstatus/db/src/schema";
import { Badge } from "@openstatus/ui/src/components/badge";

import { statusDict } from "@/data/incidents-dictionary";
import { cn } from "@/lib/utils";
import { Icons } from "../icons";

export function StatusBadge({
  status,
  className,
}: {
  status: StatusReport["status"];
  className?: string;
}) {
  const { label, icon, color } = statusDict[status];
  const Icon = Icons[icon];
  return (
    <Badge variant="outline" className={cn("font-normal", color, className)}>
      <Icon className="mr-1 h-3 w-3" />
      {label}
    </Badge>
  );
}
