"use client";

import { NavTabs } from "@/components/nav/nav-tabs";
import { SETTINGS_TABS } from "@/config/settings";

export function Tabs() {
  return (
    <NavTabs
      items={SETTINGS_TABS.map(({ value, label, icon, href }) => ({
        value,
        label,
        icon,
        href,
      }))}
    />
  );
}
