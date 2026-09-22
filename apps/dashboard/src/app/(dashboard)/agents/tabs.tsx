"use client";

import { NavTabs } from "@/components/nav/nav-tabs";

import { AGENT_TABS } from "./constants";

export function Tabs() {
  return (
    <NavTabs
      items={AGENT_TABS.map((tab) => ({
        ...tab,
        href: `/agents/${tab.value}`,
      }))}
    />
  );
}
