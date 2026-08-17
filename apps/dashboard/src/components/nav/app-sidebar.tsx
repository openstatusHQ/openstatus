"use client";

import { SidebarLeft } from "@openstatus/icons";
import { Button } from "@openstatus/ui/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  useSidebar,
} from "@openstatus/ui/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@openstatus/ui/components/ui/tooltip";
import * as React from "react";

import { Kbd } from "@/components/common/kbd";
import { NavMonitors } from "@/components/nav/nav-monitors";
import { NavOverview } from "@/components/nav/nav-overview";
import { NavStatusPages } from "@/components/nav/nav-status-pages";
import { NavUser } from "@/components/nav/nav-user";
import { WorkspaceSwitcher } from "@/components/nav/workspace-switcher";
import { NAV } from "@/config/nav";

import { NavBanner } from "./nav-banner";
import { NavHelp } from "./nav-help";

const SIDEBAR_KEYBOARD_SHORTCUT = "[";

// This is sample data.
const data = {
  user: {
    name: "mxkaske",
    email: "max@openstatus.dev",
    avatar: "/avatars/shadcn.jpg",
  },
  overview: [
    { name: "Overview", url: NAV.overview.href, icon: NAV.overview.icon },
    {
      name: "Status Pages",
      url: NAV.statusPages.href,
      icon: NAV.statusPages.icon,
    },
    { name: "Monitors", url: NAV.monitors.href, icon: NAV.monitors.icon },
    {
      name: "Notifications",
      url: NAV.notifications.href,
      icon: NAV.notifications.icon,
    },
    { name: "Settings", url: NAV.settings.href, icon: NAV.settings.icon },
    { name: "Assistant", url: NAV.chat.href, icon: NAV.chat.icon },
    { name: "Slack agent", url: NAV.agents.href, icon: NAV.agents.icon },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="flex h-14 justify-center gap-0 border-b p-0">
        <WorkspaceSwitcher />
      </SidebarHeader>
      <SidebarContent>
        <NavOverview items={data.overview} />
        <NavStatusPages />
        <NavMonitors />
        <div className="mt-auto px-2">
          <NavBanner />
        </div>
        <NavHelp />
      </SidebarContent>
      <SidebarFooter className="flex h-14 flex-col justify-center gap-0 border-t p-0">
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

export function AppSidebarTrigger() {
  const { toggleSidebar } = useSidebar();

  // Adds a keyboard shortcut to toggle the sidebar.
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === SIDEBAR_KEYBOARD_SHORTCUT &&
        (event.metaKey || event.ctrlKey)
      ) {
        event.preventDefault();
        toggleSidebar();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleSidebar]);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            data-sidebar="trigger"
            data-slot="sidebar-trigger"
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={toggleSidebar}
          >
            <SidebarLeft />
            <span className="sr-only">Toggle Sidebar</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">
          <p className="mr-px inline-flex items-center">
            Toggle Sidebar{" "}
            <Kbd className="border-muted-foreground bg-primary text-background font-mono">
              ⌘
            </Kbd>
            <Kbd className="border-muted-foreground bg-primary text-background font-mono">
              {SIDEBAR_KEYBOARD_SHORTCUT}
            </Kbd>
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
