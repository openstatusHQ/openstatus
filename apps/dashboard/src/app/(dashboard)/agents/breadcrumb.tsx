"use client";

import { Agent } from "@openstatus/icons";
import { usePathname } from "next/navigation";

import { NavBreadcrumb } from "@/components/nav/nav-breadcrumb";

import { AGENT_TABS } from "./constants";

export function Breadcrumb() {
  const pathname = usePathname();
  const segment = pathname.split("/").pop() ?? "";
  const currentTab = AGENT_TABS.find((tab) => tab.value === segment);

  return (
    <NavBreadcrumb
      items={[
        { type: "link", label: "Agents", href: "/agents/slack", icon: Agent },
        ...(currentTab
          ? [
              {
                type: "page" as const,
                label: currentTab.label,
                icon: currentTab.icon,
              },
            ]
          : []),
      ]}
    />
  );
}
