import { Badge } from "@openstatus/ui/src/components/badge";

import { StatusCodeBadge } from "@/components/monitor/status-code-badge";

export function DataTableStatusBadge({
  statusCode,
}: {
  statusCode?: number | null;
}) {
  if (!statusCode) {
    return <Badge variant="destructive">Error</Badge>;
  }
  return <StatusCodeBadge statusCode={statusCode} />;
}
