"use client";

import * as React from "react";

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Book,
  Braces,
  CalendarClock,
  HelpCircle,
  LifeBuoy,
} from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";
import Link from "next/link";
import { DiscordIcon } from "@/components/icons/discord";
import { FormDialogSupportContact } from "@/components/forms/support-contact/dialog";

export function NavHelp() {
  const { isMobile } = useSidebar();
  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton tooltip="Get Help">
                  <HelpCircle />
                  <span>Get Help</span>
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
                side={isMobile ? "bottom" : "right"}
                align="end"
                sideOffset={4}
              >
                <DropdownMenuLabel className="text-muted-foreground text-xs">
                  Get Help
                </DropdownMenuLabel>
                <FormDialogSupportContact>
                  <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                    <LifeBuoy />
                    Support
                  </DropdownMenuItem>
                </FormDialogSupportContact>
                <DropdownMenuItem asChild>
                  <Link href="#">
                    <Book /> Docs
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="#">
                    <Braces /> API Reference
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="#">
                    <CalendarClock /> Book a Call
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="#">
                    <DiscordIcon />
                    Community
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
