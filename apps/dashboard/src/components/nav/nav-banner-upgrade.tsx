"use client";

import { allPlans } from "@openstatus/db/src/schema/plan/config";
import { Clock, Close, Globe, Notification, Team } from "@openstatus/icons";
import { SlackIcon } from "@openstatus/icons/brand";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@openstatus/ui/components/ui/sidebar";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { useTRPC } from "@/lib/trpc/client";

import { UpgradeDialog } from "../dialogs/upgrade";

const plan = allPlans.starter;

const features = [
  {
    icon: Clock,
    title: `1 min checks, ${plan.limits.monitors} monitors`,
  },
  { icon: Globe, title: "Custom domain & subscribers" },
  { icon: Team, title: "Unlimited team members" },
  { icon: SlackIcon, title: "Slack integration" },
  { icon: Notification, title: "PagerDuty, Opsgenie & WhatsApp" },
];

export function NavBannerUpgrade({ handleClose }: { handleClose: () => void }) {
  const trpc = useTRPC();
  const { data: workspace } = useQuery(trpc.workspace.get.queryOptions());
  const [open, setOpen] = useState(false);

  if (!workspace) return null;

  return (
    <SidebarGroup className="bg-background rounded-lg border px-2 py-1.5 group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel className="flex h-7 items-center justify-between pr-0 pl-0">
        <span>Upgrade to {plan.title}</span>
        <SidebarMenuAction
          onClick={handleClose}
          className="relative top-0 right-0"
        >
          <Close className="text-muted-foreground" size={16} />
        </SidebarMenuAction>
      </SidebarGroupLabel>
      <SidebarMenu>
        {features.map((feature) => (
          <SidebarMenuItem
            key={feature.title}
            className="flex items-center gap-2 text-sm"
          >
            <feature.icon className="text-muted-foreground size-3 shrink-0" />
            <span>{feature.title}</span>
          </SidebarMenuItem>
        ))}
        <SidebarMenuItem className="pt-1">
          <SidebarMenuButton
            className="justify-center border"
            data-active="true"
            onClick={() => setOpen(true)}
          >
            Upgrade
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
      <UpgradeDialog open={open} onOpenChange={setOpen} />
    </SidebarGroup>
  );
}
