import type {
  IncidentSeverity,
  IncidentStatus,
} from "@openstatus/db/src/schema/incidents/constants";

import { StatusBadge } from "@/components/common/status-badge";
import { severityConfig, statusConfig } from "@/data/managed-incidents.client";

type StatusBadgeProps = Omit<
  React.ComponentProps<typeof StatusBadge>,
  "children" | "variant" | "dot"
>;

export function IncidentStatusBadge({
  status,
  closed = false,
  ...props
}: StatusBadgeProps & { status: IncidentStatus; closed?: boolean }) {
  const config = statusConfig[status];
  return (
    <StatusBadge variant={config.variant} dot {...props}>
      {config.label}
      {closed && status !== "canceled" ? " · closed" : null}
    </StatusBadge>
  );
}

export function IncidentSeverityBadge({
  severity,
  ...props
}: StatusBadgeProps & { severity: IncidentSeverity }) {
  const config = severityConfig[severity];
  return (
    <StatusBadge variant={config.variant} {...props}>
      {config.label}
    </StatusBadge>
  );
}
