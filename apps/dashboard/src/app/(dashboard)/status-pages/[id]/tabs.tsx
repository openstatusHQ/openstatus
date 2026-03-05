"use client";

import { NavTabs } from "@/components/nav/nav-tabs";
import { Cog, Hammer, LayoutTemplate, Megaphone, Users } from "lucide-react";
import { useParams } from "next/navigation";

export function Tabs() {
  const { id } = useParams<{ id: string }>();

  return (
    <NavTabs
      items={[
        {
          value: "status-reports",
          label: "Status Reports",
          icon: Megaphone,
          href: `/status-pages/${id}/status-reports`,
        },
        {
          value: "maintenances",
          label: "Maintenances",
          icon: Hammer,
          href: `/status-pages/${id}/maintenances`,
        },
        {
          value: "subscribers",
          label: "Subscribers",
          icon: Users,
          href: `/status-pages/${id}/subscribers`,
        },
        {
          value: "components",
          label: "Components",
          icon: LayoutTemplate,
          href: `/status-pages/${id}/components`,
        },
        {
          value: "edit",
          label: "Settings",
          icon: Cog,
          href: `/status-pages/${id}/edit`,
        },
      ]}
    />
  );
}
