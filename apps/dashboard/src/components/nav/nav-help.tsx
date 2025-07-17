"use client";

import * as React from "react";

import { FormDialogSupportContact } from "@/components/forms/support-contact/dialog";
import { DiscordIcon } from "@/components/icons/discord";
import { GitHubIcon } from "@/components/icons/github";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useSidebar } from "@/components/ui/sidebar";
import {
  Book,
  Braces,
  CalendarClock,
  HelpCircle,
  LifeBuoy,
} from "lucide-react";
import Link from "next/link";

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
                  <Link
                    href="https://docs.openstatus.dev"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Book /> Docs
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link
                    href="https://api.openstatus.dev/v1"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Braces /> API Reference
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link
                    href="https://openstatus.dev/cal"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <CalendarClock /> Book a Call
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link
                    href="https://openstatus.dev/discord"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <DiscordIcon />
                    Community
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link
                    href="https://openstatus.dev/github"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <GitHubIcon />
                    GitHub
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
