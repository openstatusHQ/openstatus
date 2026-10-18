import type { StatusReportStatus } from "@openstatus/db/src/schema";

import { StatusBadge } from "@/components/common/status-badge";
import { statusVariants } from "@/data/status-report-updates.client";

type BadgeProps = Omit<
  React.ComponentProps<typeof StatusBadge>,
  "children" | "variant" | "dot"
>;

export function StatusReportStatusBadge({
  status,
  ...props
}: BadgeProps & { status: StatusReportStatus }) {
  return (
    <StatusBadge variant={statusVariants[status]} dot {...props}>
      <span className="capitalize">{status}</span>
    </StatusBadge>
  );
}
