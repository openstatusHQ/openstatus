import type { Ping } from "@openstatus/tinybird";
import { Badge } from "@openstatus/ui/src/components/badge";

import { StatusCodeBadge } from "../monitor/status-code-badge";

export function DataTableStatusBadge({
  statusCode,
}: {
  statusCode: Ping["statusCode"];
}) {
  if (!statusCode) {
    return <Badge variant="destructive">Error</Badge>;
  }
  return <StatusCodeBadge statusCode={statusCode} />;
}
