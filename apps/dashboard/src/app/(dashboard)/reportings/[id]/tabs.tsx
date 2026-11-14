"use client";

import { useParams } from "next/navigation";

import { NavTabs } from "@/components/nav/nav-tabs";

import { REPORTING_TABS } from "./constants";

export function Tabs() {
  const { id } = useParams<{ id: string }>();

  return (
    <NavTabs
      items={REPORTING_TABS.map((tab) => ({
        ...tab,
        href: `/reportings/${id}/${tab.value}`,
      }))}
    />
  );
}
