"use client";

import {
  Monitor,
  Notification,
  Agent,
  Settings,
  Overview,
  Chat,
  StatusPage,
} from "@openstatus/icons";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  SidebarTrigger,
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
    {
      name: "Overview",
      url: "/overview",
      icon: Overview,
    },
    {
      name: "Status Pages",
      url: "/status-pages",
      icon: StatusPage,
    },
    {
      name: "Monitors",
      url: "/monitors",
      icon: Monitor,
    },
    {
      name: "Notifications",
      url: "/notifications",
      icon: Notification,
    },
    {
      name: "Settings",
      url: "/settings/general",
      icon: Settings,
    },
    {
      name: "Assistant",
      url: "/chat",
      icon: Chat,
    },
    {
      name: "Slack agent",
      url: "/agents",
      icon: Agent,
    },
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
          <SidebarTrigger />
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
