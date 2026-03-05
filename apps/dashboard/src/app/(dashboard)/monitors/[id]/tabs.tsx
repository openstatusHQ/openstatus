"use client";

import { NavTabs } from "@/components/nav/nav-tabs";
import { useParams } from "next/navigation";
import { MONITOR_TABS } from "./constants";

export function Tabs() {
  const { id } = useParams<{ id: string }>();

  return (
    <NavTabs
      items={MONITOR_TABS.map((tab) => ({
        ...tab,
        href: `/monitors/${id}/${tab.value}`,
      }))}
    />
  );
}
