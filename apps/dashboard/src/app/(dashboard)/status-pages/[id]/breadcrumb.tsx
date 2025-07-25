"use client";

import { NavBreadcrumb } from "@/components/nav/nav-breadcrumb";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { Cog, Hammer, Megaphone, Users } from "lucide-react";
import { useParams } from "next/navigation";

export function Breadcrumb() {
  const { id } = useParams<{ id: string }>();
  const trpc = useTRPC();
  const { data: statusPage } = useQuery(
    trpc.page.get.queryOptions({ id: Number.parseInt(id) }),
  );

  if (!statusPage) return null;

  return (
    <NavBreadcrumb
      items={[
        {
          type: "link",
          label: "Status Pages",
          href: "/status-pages",
        },
        { type: "page", label: statusPage.title },
        {
          type: "select",
          items: [
            {
              value: "status-reports",
              label: "Status Reports",
              icon: Megaphone,
            },
            { value: "maintenances", label: "Maintenances", icon: Hammer },
            { value: "subscribers", label: "Subscribers", icon: Users },
            { value: "edit", label: "Settings", icon: Cog },
          ],
        },
      ]}
    />
  );
}
