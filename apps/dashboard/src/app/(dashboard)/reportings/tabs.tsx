"use client";

import { NavTabs } from "@/components/nav/nav-tabs";

import { SLA_POLICY_TABS } from "./constants";

export function Tabs() {
  return <NavTabs items={[...SLA_POLICY_TABS]} />;
}
