"use client";

import { NavTabs } from "@/components/nav/nav-tabs";

import { REPORTING_TABS } from "./constants";

export function Tabs() {
  return <NavTabs items={[...REPORTING_TABS]} />;
}
