"use client";

import { SidebarLeft } from "@openstatus/icons";
import { Button } from "@openstatus/ui/components/ui/button";
import { Kbd, KbdGroup } from "@openstatus/ui/components/ui/kbd";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  SidebarSeparator,
  useSidebar,
} from "@openstatus/ui/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@openstatus/ui/components/ui/tooltip";
import * as React from "react";

import { NavGroup, NavGroupDefaultItem } from "@/components/nav/nav-group";
import { NavMonitorsItem } from "@/components/nav/nav-monitors";
import { NavSearch } from "@/components/nav/nav-search";
import { NavStatusPagesItem } from "@/components/nav/nav-status-pages";
import { NavUser } from "@/components/nav/nav-user";
import { WorkspaceSwitcher } from "@/components/nav/workspace-switcher";
import { NAV, NAV_GROUPS, type NavItem } from "@/config/nav";

import { NavBanner } from "./nav-banner";
import { NavHelp } from "./nav-help";

const SIDEBAR_KEYBOARD_SHORTCUT = "[";

// items that peek at their entities on hover; the rest render from config
const PEEK_ITEMS = new Map<NavItem, React.ComponentType>([
  [NAV.monitors, NavMonitorsItem],
  [NAV.statusPages, NavStatusPagesItem],
]);

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="flex h-14 justify-center gap-0 border-b p-0">
        <WorkspaceSwitcher />
      </SidebarHeader>
      {/* no gap: NavGroup's py-1 alone keeps groups on the 36px row grid */}
      <SidebarContent className="gap-0">
        <NavGroup className="pt-2">
          <NavSearch />
          <NavGroupDefaultItem item={NAV.overview} />
          <NavGroupDefaultItem item={NAV.chat} />
        </NavGroup>
        {NAV_GROUPS.map((group) => (
          <NavGroup
            key={group.label ?? group.items[0].href}
            label={group.label}
            standalone={!group.label}
          >
            {group.items.map((item) => {
              const Peek = PEEK_ITEMS.get(item);
              return Peek ? (
                <Peek key={item.label} />
              ) : (
                <NavGroupDefaultItem key={item.label} item={item} />
              );
            })}
          </NavGroup>
        ))}
        <div className="mt-auto px-2 pb-1 group-data-[collapsible=icon]:pt-0! group-data-[collapsible=icon]:pb-1! has-[>*]:pt-1 has-[>*]:pb-2">
          <NavBanner />
        </div>
        <SidebarSeparator className="mx-0" />
        <NavGroup className="py-2">
          <NavGroupDefaultItem item={NAV.settings} />
          <NavHelp />
        </NavGroup>
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
        <TooltipContent side="right" className="flex items-center gap-2">
          Toggle Sidebar
          <KbdGroup>
            <Kbd>⌘</Kbd>
            <Kbd>{SIDEBAR_KEYBOARD_SHORTCUT}</Kbd>
          </KbdGroup>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
