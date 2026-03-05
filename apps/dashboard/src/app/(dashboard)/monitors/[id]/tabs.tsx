"use client";

import { NavTabs } from "@/components/nav/nav-tabs";
import { Cog, LayoutGrid, Logs, Siren } from "lucide-react";
import { useParams } from "next/navigation";

export function Tabs() {
  const { id } = useParams<{ id: string }>();

  return (
    <NavTabs
      items={[
        {
          value: "overview",
          label: "Overview",
          icon: LayoutGrid,
          href: `/monitors/${id}/overview`,
        },
        {
          value: "logs",
          label: "Logs",
          icon: Logs,
          href: `/monitors/${id}/logs`,
        },
        {
          value: "incidents",
          label: "Incidents",
          icon: Siren,
          href: `/monitors/${id}/incidents`,
        },
        {
          value: "edit",
          label: "Settings",
          icon: Cog,
          href: `/monitors/${id}/edit`,
        },
      ]}
    />
  );
}
