"use client";

import {
  Activity,
  Bell,
  Cog,
  LayoutGrid,
  PanelTop,
  Terminal,
} from "lucide-react";
import * as React from "react";

import { Kbd } from "@/components/common/kbd";
import { NavMonitors } from "@/components/nav/nav-monitors";
import { NavOverview } from "@/components/nav/nav-overview";
import { NavStatusPages } from "@/components/nav/nav-status-pages";
import { NavUser } from "@/components/nav/nav-user";
import { WorkspaceSwitcher } from "@/components/nav/workspace-switcher";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
      icon: LayoutGrid,
    },
    {
      name: "Monitors",
      url: "/monitors",
      icon: Activity,
    },
    {
      name: "Status Pages",
      url: "/status-pages",
      icon: PanelTop,
    },
    {
      name: "Notifications",
      url: "/notifications",
      icon: Bell,
    },
    {
      name: "Settings",
      url: "/settings/general",
      icon: Cog,
    },
    {
      name: "CLI",
      url: "/cli",
      icon: Terminal,
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
            <Kbd className="border-muted-foreground bg-primary font-mono text-background">
              ⌘
            </Kbd>
            <Kbd className="border-muted-foreground bg-primary font-mono text-background">
              {SIDEBAR_KEYBOARD_SHORTCUT}
            </Kbd>
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
