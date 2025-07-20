"use client";

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { Rocket, X } from "lucide-react";
import { useState } from "react";
import { UpgradeDialog } from "../dialogs/upgrade";

export function NavBannerUpgrade({ handleClose }: { handleClose: () => void }) {
  const trpc = useTRPC();
  const { data: workspace } = useQuery(trpc.workspace.get.queryOptions());
  const [open, setOpen] = useState(false);

  if (!workspace) return null;

  return (
    <SidebarGroup className="rounded-lg border bg-background group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel className="flex items-center justify-between pr-1">
        <span>OpenStatus Pro</span>
        <SidebarMenuAction
          onClick={handleClose}
          className="relative top-0 right-0"
        >
          <X className="text-muted-foreground" size={16} />
        </SidebarMenuAction>
      </SidebarGroupLabel>
      <SidebarMenu>
        <SidebarMenuItem className="flex items-center gap-2 text-sm">
          <Rocket className="text-info shrink-0" size={12} />
          <span>
            Unlock custom domains, teams, 1 min. checks, subscriptions and more.
          </span>
        </SidebarMenuItem>
        <SidebarMenuItem>
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
