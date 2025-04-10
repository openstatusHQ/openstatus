import { cn } from "@/lib/utils";
import type { StatusReport } from "@openstatus/db/src/schema";
import { Badge } from "@openstatus/ui";

import { severityDict } from "@/data/incidents-dictionary";

export function SeverityBadge({
  severity,
}: {
  severity: StatusReport["severity"];
}) {
  if (!severity) return null;
  const config = severityDict[severity];

  return (
    <Badge className={cn(config.color, "rounded-full")}>{config.label}</Badge>
  );
}
