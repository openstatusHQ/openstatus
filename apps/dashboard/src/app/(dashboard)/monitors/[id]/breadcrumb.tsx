"use client";

import { NavBreadcrumb } from "@/components/nav/nav-breadcrumb";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { Activity, Cog, LayoutGrid, Logs, Siren } from "lucide-react";
import { useParams, usePathname } from "next/navigation";

export function Breadcrumb() {
  const { id } = useParams<{ id: string }>();
  const pathname = usePathname();
  const trpc = useTRPC();
  const { data: monitor } = useQuery(
    trpc.monitor.get.queryOptions({ id: Number.parseInt(id) }),
  );

  if (!monitor) return null;

  return (
    <NavBreadcrumb
      items={[
        { type: "link", label: "Monitors", href: "/monitors", icon: Activity },
        pathname === `/monitors/${id}/overview`
          ? { type: "page", label: monitor.name }
          : {
              type: "link",
              label: monitor.name,
              href: `/monitors/${id}/overview`,
            },
        {
          type: "select",
          items: [
            { value: "overview", label: "Overview", icon: LayoutGrid },
            { value: "logs", label: "Logs", icon: Logs },
            { value: "incidents", label: "Incidents", icon: Siren },
            { value: "edit", label: "Settings", icon: Cog },
          ],
        },
      ]}
    />
  );
}
