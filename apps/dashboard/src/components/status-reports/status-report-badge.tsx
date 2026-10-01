import type { StatusReportStatus } from "@openstatus/db/src/schema";
import type { PageComponentImpact } from "@openstatus/db/src/schema/page_components/constants";

import { StatusBadge } from "@/components/common/status-badge";
import {
  impactDisplay,
  statusVariants,
} from "@/data/status-report-updates.client";

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

/** `null` is a legacy report without impact rows. */
export function StatusReportImpactBadge({
  impact,
  ...props
}: BadgeProps & { impact: PageComponentImpact | null }) {
  const display = impactDisplay(impact);
  return (
    <StatusBadge variant={display.variant} {...props}>
      {display.label}
    </StatusBadge>
  );
}
