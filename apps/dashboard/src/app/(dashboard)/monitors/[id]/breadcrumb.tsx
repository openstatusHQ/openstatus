"use client";

import { NavBreadcrumb } from "@/components/nav/nav-breadcrumb";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { Activity, Cog, LayoutGrid, Logs, Siren } from "lucide-react";
import { useParams, usePathname } from "next/navigation";

const pages: Record<string, { label: string; icon: typeof Activity }> = {
  overview: { label: "Overview", icon: LayoutGrid },
  logs: { label: "Logs", icon: Logs },
  incidents: { label: "Incidents", icon: Siren },
  edit: { label: "Settings", icon: Cog },
};

export function Breadcrumb() {
  const { id } = useParams<{ id: string }>();
  const pathname = usePathname();
  const trpc = useTRPC();
  const { data: monitor } = useQuery(
    trpc.monitor.get.queryOptions({ id: Number.parseInt(id) }),
  );

  if (!monitor) return null;

  const segment = pathname.split("/").pop() ?? "";
  const currentPage = pages[segment];

  return (
    <NavBreadcrumb
      items={[
        { type: "link", label: "Monitors", href: "/monitors", icon: Activity },
        {
          type: "link",
          label: monitor.name,
          href: `/monitors/${id}/overview`,
        },
        ...(currentPage
          ? [
              {
                type: "page" as const,
                label: currentPage.label,
                icon: currentPage.icon,
              },
            ]
          : []),
      ]}
    />
  );
}
