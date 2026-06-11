"use client";

import { useParams } from "next/navigation";

import { NavTabs } from "@/components/nav/nav-tabs";

import { STATUS_PAGE_TABS } from "./constants";

export function Tabs() {
  const { id } = useParams<{ id: string }>();

  return (
    <NavTabs
      items={STATUS_PAGE_TABS.map((tab) => ({
        ...tab,
        href: `/status-pages/${id}/${tab.value}`,
      }))}
    />
  );
}
