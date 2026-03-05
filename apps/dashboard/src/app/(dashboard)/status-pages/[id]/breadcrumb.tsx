"use client";

import { NavBreadcrumb } from "@/components/nav/nav-breadcrumb";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery } from "@tanstack/react-query";
import {
  Cog,
  Hammer,
  LayoutTemplate,
  Megaphone,
  PanelTop,
  Users,
} from "lucide-react";
import { useParams, usePathname } from "next/navigation";

const pages: Record<string, { label: string; icon: typeof PanelTop }> = {
  "status-reports": { label: "Status Reports", icon: Megaphone },
  maintenances: { label: "Maintenances", icon: Hammer },
  subscribers: { label: "Subscribers", icon: Users },
  components: { label: "Components", icon: LayoutTemplate },
  edit: { label: "Settings", icon: Cog },
};

export function Breadcrumb() {
  const { id } = useParams<{ id: string }>();
  const pathname = usePathname();
  const trpc = useTRPC();
  const { data: statusPage } = useQuery(
    trpc.page.get.queryOptions({ id: Number.parseInt(id) }),
  );

  if (!statusPage) return null;

  const segment = pathname.split("/").pop() ?? "";
  const currentPage = pages[segment];

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
