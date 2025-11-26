import { getStatus } from "@openstatus/react";
import Link from "next/link";
import { cn } from "@openstatus/ui";

export async function FooterStatus() {
  const status = await getStatus("status");
  return (
    <Link
      href="https://status.openstatus.dev"
      className={cn(
        "flex w-full items-center gap-2 p-4 hover:bg-muted",
        STATUS[status.status].color
      )}
    >
      {STATUS[status.status].label}
    </Link>
  );
}

const STATUS = {
  operational: { color: "text-success", label: "Operational" },
  degraded_performance: {
    color: "text-warning",
    label: "Degraded Performance",
  },
  partial_outage: { color: "text-warning", label: "Partial Outage" },
  major_outage: { color: "text-error", label: "Major Outage" },
  under_maintenance: { color: "text-info", label: "Under Maintenance" },
  unknown: { color: "text-gray-500", label: "Unknown" },
  incident: { color: "text-warning", label: "Incident" },
} satisfies Record<
  Awaited<ReturnType<typeof getStatus>>["status"],
  { color: string; label: string }
>;
