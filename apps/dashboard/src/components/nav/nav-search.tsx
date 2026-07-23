"use client";

import { Search } from "@openstatus/icons";
import { Kbd } from "@openstatus/ui/components/ui/kbd";
import {
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@openstatus/ui/components/ui/sidebar";

import { useCommandMenu } from "@/components/command-menu/provider";

export function NavSearch() {
  const { setOpen } = useCommandMenu();
  const { setOpenMobile } = useSidebar();
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        onClick={() => {
          setOpenMobile(false);
          setOpen(true);
        }}
        tooltip="Search"
        variant="outline"
        className="group/search"
      >
        <Search />
        <span>Search</span>
        <div className="group-hover/search:text-foreground ms-auto space-x-1 font-mono group-data-[collapsible=icon]:hidden">
          <Kbd>⌘</Kbd>
          <Kbd>K</Kbd>
        </div>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
