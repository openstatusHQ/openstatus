"use client";

import { NavBreadcrumb } from "@/components/nav/nav-breadcrumb";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { PanelTop } from "lucide-react";
import { useParams, usePathname } from "next/navigation";
import { STATUS_PAGE_TABS } from "./constants";

export function Breadcrumb() {
  const { id } = useParams<{ id: string }>();
  const pathname = usePathname();
  const trpc = useTRPC();
  const { data: statusPage } = useQuery(
    trpc.page.get.queryOptions({ id: Number.parseInt(id) }),
  );

  if (!statusPage) return null;

  const segments = pathname.split("/");
  const currentTab = STATUS_PAGE_TABS.find((tab) =>
    segments.includes(tab.value),
  );

  return (
    <NavBreadcrumb
      items={[
        {
          type: "link",
          label: "Status Pages",
          href: "/status-pages",
          icon: PanelTop,
        },
        {
          type: "link",
          label: statusPage.title,
          href: `/status-pages/${id}/status-reports`,
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
