"use client";

import { NavBreadcrumb } from "@/components/nav/nav-breadcrumb";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { Activity } from "lucide-react";
import { useParams, usePathname } from "next/navigation";
import { MONITOR_TABS } from "./constants";

export function Breadcrumb() {
  const { id } = useParams<{ id: string }>();
  const pathname = usePathname();
  const trpc = useTRPC();
  const { data: monitor } = useQuery(
    trpc.monitor.get.queryOptions({ id: Number.parseInt(id) }),
  );

  if (!monitor) return null;

  const segment = pathname.split("/").pop() ?? "";
  const currentTab = MONITOR_TABS.find((tab) => tab.value === segment);

  return (
    <NavBreadcrumb
      items={[
        { type: "link", label: "Monitors", href: "/monitors", icon: Activity },
        {
          type: "link",
          label: monitor.name,
          href: `/monitors/${id}/overview`,
        },
        ...(currentTab
          ? [
              {
                type: "page" as const,
                label: currentTab.label,
                icon: currentTab.icon,
              },
            ]
          : []),
      ]}
    />
  );
}
