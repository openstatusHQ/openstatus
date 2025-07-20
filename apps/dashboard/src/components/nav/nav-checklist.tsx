"use client";

import { Link } from "@/components/common/link";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { CircleCheck, CircleDashed, X } from "lucide-react";

// TODO: add a close action to localStorage

export function NavChecklist() {
  const trpc = useTRPC();
  const { data: workspace } = useQuery(trpc.workspace.get.queryOptions());

  if (!workspace) return null;

  const hasMonitors = workspace.usage?.monitors ?? 0 > 0;
  const hasStatusPages = workspace.usage?.pages ?? 0 > 0;
  const hastNotifications = workspace.usage?.notifications ?? 0 > 0;

  if (hasMonitors && hasStatusPages && hastNotifications) return null;

  const items = [
    {
      title: "Create Monitor",
      checked: hasMonitors,
      href: "/monitors/create",
    },
    {
      title: "Create Status Page",
      checked: hasStatusPages,
      href: "/status-pages/create",
    },
    {
      title: "Create Notification",
      checked: hastNotifications,
      href: "/notifications",
    },
  ];

  return (
    <SidebarGroup className="rounded-lg border bg-background group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel className="flex items-center justify-between pr-1">
        <span>Getting Started</span>
        <SidebarMenuAction className="relative top-0 right-0">
          <X className="text-muted-foreground" size={16} />
        </SidebarMenuAction>
      </SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => (
          <SidebarMenuItem
            key={item.title}
            className="flex items-center gap-2 text-sm"
          >
            {item.checked ? (
              <>
                <CircleCheck className="text-success" size={12} />
                <span>{item.title}</span>
              </>
            ) : (
              <>
                <CircleDashed className="text-muted-foreground/50" size={12} />
                <Link href={item.href}>{item.title}</Link>
              </>
            )}
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}
