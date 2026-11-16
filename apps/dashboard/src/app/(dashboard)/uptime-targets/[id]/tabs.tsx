"use client";

import { useParams } from "next/navigation";

import { NavTabs } from "@/components/nav/nav-tabs";

import { UPTIME_TARGET_TABS } from "./constants";

export function Tabs() {
  const { id } = useParams<{ id: string }>();

  return (
    <NavTabs
      items={UPTIME_TARGET_TABS.map((tab) => ({
        ...tab,
        href: `/uptime-targets/${id}/${tab.value}`,
      }))}
    />
  );
}
