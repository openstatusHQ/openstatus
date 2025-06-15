"use client";

import { NavBreadcrumb } from "@/components/nav/nav-breadcrumb";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { Hammer, Megaphone, Pencil, Users } from "lucide-react";

export function Breadcrumb() {
  const { id } = useParams<{ id: string }>();
  const trpc = useTRPC();
  const { data: statusPage } = useQuery(
    trpc.page.get.queryOptions({ id: parseInt(id) })
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
            { value: "edit", label: "Edit", icon: Pencil },
            {
              value: "status-reports",
              label: "Status Reports",
              icon: Megaphone,
            },
            { value: "maintenances", label: "Maintenances", icon: Hammer },
            { value: "subscribers", label: "Subscribers", icon: Users },
          ],
        },
      ]}
    />
  );
}
