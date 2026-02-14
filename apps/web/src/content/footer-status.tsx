"use client";

import { cn } from "@/lib/utils";
import type { StatusResponse } from "@openstatus/react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

export function FooterStatus() {
  const { data } = useQuery({
    queryKey: ["footer-status"],
    queryFn: async () => {
      const res = await fetch(
        "https://api.openstatus.dev/public/status/status",
      );
      if (!res.ok) return { status: "unknown" as const };
      return (await res.json()) as StatusResponse;
    },
    refetchInterval: 60000, // Refetch every 60 seconds
    staleTime: 60000,
  });

  const status = data?.status ?? "unknown";

  return (
    <Link
      href="https://status.openstatus.dev"
      className={cn(
        "flex w-full items-center gap-2 p-4 hover:bg-muted",
        STATUS[status].color,
      )}
    >
      {STATUS[status].label}
    </Link>
  );
}

const STATUS = {
  operational: {
    color: "text-green-700 dark:text-green-400",
    label: "Operational",
  },
  degraded_performance: {
    color: "text-yellow-700 dark:text-yellow-400",
    label: "Degraded Performance",
  },
  partial_outage: {
    color: "text-yellow-700 dark:text-yellow-400",
    label: "Partial Outage",
  },
  major_outage: {
    color: "text-red-700 dark:text-red-400",
    label: "Major Outage",
  },
  under_maintenance: {
    color: "text-blue-700 dark:text-blue-400",
    label: "Under Maintenance",
  },
  unknown: { color: "text-gray-700 dark:text-gray-400", label: "Unknown" },
  incident: {
    color: "text-yellow-700 dark:text-yellow-400",
    label: "Incident",
  },
} satisfies Record<StatusResponse["status"], { color: string; label: string }>;
