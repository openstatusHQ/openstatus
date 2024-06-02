import type { Ping } from "@openstatus/tinybird";
import { Badge } from "@openstatus/ui";

import { StatusCodeBadge } from "../monitor/status-code-badge";

export function DataTableStatusBadge({
  statusCode,
}: {
  statusCode: Ping["statusCode"];
}) {
  if (!statusCode) {
    return (
      <Badge
        variant="outline"
        className="border-rose-500/20 bg-rose-500/10 text-rose-800 dark:text-rose-300"
      >
        Error
      </Badge>
    );
  }
  return <StatusCodeBadge statusCode={statusCode} />;
}
