"use client";

import {
  playbookDefaultTitle,
  playbookSlugs,
} from "@openstatus/db/src/schema/playbooks/constants";
import { Agent } from "@openstatus/icons";
import { useQuery } from "@tanstack/react-query";
import { usePathname } from "next/navigation";

import { NavBreadcrumb } from "@/components/nav/nav-breadcrumb";
import { useTRPC } from "@/lib/trpc/client";

import { AGENT_TABS } from "./constants";

export function Breadcrumb() {
  const pathname = usePathname();
  const [, , segment = "", child] = pathname.split("/");
  const currentTab = AGENT_TABS.find((tab) => tab.value === segment);
  const slug =
    segment === "playbooks"
      ? playbookSlugs.find((s) => s === child)
      : undefined;
  const trpc = useTRPC();
  const { data: playbooks } = useQuery({
    ...trpc.playbook.list.queryOptions(),
    enabled: slug !== undefined,
  });

  return (
    <NavBreadcrumb
      items={[
        { type: "link", label: "Agents", href: "/agents/slack", icon: Agent },
        ...(currentTab && slug
          ? [
              {
                type: "link" as const,
                label: currentTab.label,
                href: "/agents/playbooks",
                icon: currentTab.icon,
              },
              {
                type: "page" as const,
                label:
                  playbooks?.find((p) => p.slug === slug)?.title ??
                  playbookDefaultTitle[slug],
              },
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
