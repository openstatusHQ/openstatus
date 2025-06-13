"use client";

import * as React from "react";
import { LayoutGrid, Cog, Bell, PanelTop, Activity } from "lucide-react";

import { NavMonitors } from "@/components/nav/nav-monitors";
import { NavUser } from "@/components/nav/nav-user";
import { OrganizationSwitcher } from "@/components/nav/organization-switcher";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { NavStatusPages } from "@/components/nav/nav-status-pages";
import { NavOverview } from "@/components/nav/nav-overview";
import { NavChecklist } from "./nav-checklist";
import {
  TooltipContent,
  TooltipTrigger,
  Tooltip,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { Kbd } from "@/components/common/kbd";
import { NavHelp } from "./nav-help";
import { monitors } from "@/data/monitors";
import { statusPages } from "@/data/status-pages";

const SIDEBAR_KEYBOARD_SHORTCUT = "[";

// This is sample data.
const data = {
  user: {
    name: "mxkaske",
    email: "max@openstatus.dev",
    avatar: "/avatars/shadcn.jpg",
  },
  orgs: [
    {
      name: "OpenStatus",
      slug: "easy-peasy",
      plan: "Hobby",
    },
    {
      name: "Acme Corp.",
      slug: "acme-corp",
      plan: "Starter",
    },
  ],
  monitors: [
    {
      name: "OpenStatus Marketing",
      url: "/dashboard/monitors/overview",
      tags: ["Production"],
    },
    {
      name: "OpenStatus API",
      url: "/dashboard/monitors/overview",
      tags: ["Production"],
    },
    {
      name: "OpenStatus Dashboard",
      url: "/dashboard/monitors/overview",
      tags: ["Production"],
    },
    {
      name: "Lightweight OS",
      url: "/dashboard/monitors/overview",
      tags: ["Development"],
    },
    {
      name: "Astro Status Page",
      url: "/dashboard/monitors/overview",
      tags: ["Development"],
    },
    {
      name: "Vercel Edge Ping",
      url: "/dashboard/monitors/overview",
      tags: ["Staging"],
    },
  ],
  statusPages: [
    {
      name: "OpenStatus Status",
      url: "/dashboard/status-pages/status-reports",
    },
  ],
  overview: [
    {
      name: "Overview",
      url: "/dashboard/overview",
      icon: LayoutGrid,
    },
    {
      name: "Monitors",
      url: "/dashboard/monitors",
      icon: Activity,
    },
    {
      name: "Status Pages",
      url: "/dashboard/status-pages",
      icon: PanelTop,
    },
    {
      name: "Notifiers",
      url: "/dashboard/notifiers",
      icon: Bell,
    },
    {
      name: "Settings",
      url: "/dashboard/settings/general",
      icon: Cog,
    },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="border-b py-1 h-14 flex justify-center">
        <OrganizationSwitcher orgs={data.orgs} />
      </SidebarHeader>
      <SidebarContent>
        <NavOverview items={data.overview} />
        {/* NOTE: replacing data.monitors data.statusPages */}
        <NavStatusPages statusPages={statusPages} />
        <NavMonitors monitors={monitors} />
        <div className="mt-auto px-2">
          <NavChecklist />
        </div>
        <NavHelp />
      </SidebarContent>
      <SidebarFooter className="border-t">
        <NavUser user={data.user} />
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
          <p className="mr-px inline-flex items-center gap-1">
            Toggle Sidebar{" "}
            <Kbd className="bg-primary text-background border-muted-foreground">
              ⌘+{SIDEBAR_KEYBOARD_SHORTCUT}
            </Kbd>
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
