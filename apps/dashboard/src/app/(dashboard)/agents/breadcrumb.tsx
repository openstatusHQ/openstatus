"use client";

import { playbookLabel } from "@openstatus/db/src/schema/playbooks/constants";
import { Agent } from "@openstatus/icons";
import { usePathname } from "next/navigation";

import { NavBreadcrumb } from "@/components/nav/nav-breadcrumb";
import { playbookTypeFromSlug } from "@/data/playbooks.client";

import { AGENT_TABS } from "./constants";

export function Breadcrumb() {
  const pathname = usePathname();
  const [, , segment = "", child] = pathname.split("/");
  const currentTab = AGENT_TABS.find((tab) => tab.value === segment);
  const playbook =
    segment === "playbooks" && child ? playbookTypeFromSlug(child) : undefined;

  return (
    <NavBreadcrumb
      items={[
        { type: "link", label: "Agents", href: "/agents/slack", icon: Agent },
        ...(currentTab && playbook
          ? [
              {
                type: "link" as const,
                label: currentTab.label,
                href: "/agents/playbooks",
                icon: currentTab.icon,
              },
              { type: "page" as const, label: playbookLabel[playbook] },
            ]
          : currentTab
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
