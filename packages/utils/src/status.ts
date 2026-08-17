export type PageUpdateStatus =
  | "investigating"
  | "identified"
  | "monitoring"
  | "resolved"
  | "maintenance";

const STATUS_LABEL: Record<PageUpdateStatus, string> = {
  investigating: "Investigating",
  identified: "Identified",
  monitoring: "Monitoring",
  resolved: "Resolved",
  maintenance: "Planned Maintenance",
};

export function statusLabel(status: PageUpdateStatus): string {
  return STATUS_LABEL[status];
}
