"use client";

import { NavTabs } from "@/components/nav/nav-tabs";

import { DEVELOPER_TABS } from "./constants";

export function Tabs() {
  return (
    <NavTabs
      items={DEVELOPER_TABS.map((tab) => ({
        ...tab,
        href: `/developers/${tab.value}`,
      }))}
    />
  );
}
