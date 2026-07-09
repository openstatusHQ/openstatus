"use client";

import { Docs, Api, Schedule, Help, Support } from "@openstatus/icons";
import { DiscordIcon } from "@openstatus/icons/brand";
import { GitHubIcon } from "@openstatus/icons/brand";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@openstatus/ui/components/ui/dropdown-menu";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@openstatus/ui/components/ui/sidebar";
import Link from "next/link";

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
                <SidebarMenuButton
                  className="font-commit-mono tracking-tight"
                  tooltip="Get Help"
                >
                  <Help />
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
                    <Support />
                    Support
                  </DropdownMenuItem>
                </FormDialogSupportContact>
                <DropdownMenuItem asChild>
                  <Link
                    href="https://www.openstatus.dev/docs"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Docs /> Docs
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link
                    href="https://api.openstatus.dev/openapi"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Api /> API Reference
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link
                    href="https://openstatus.dev/cal"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Schedule /> Book a Call
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
