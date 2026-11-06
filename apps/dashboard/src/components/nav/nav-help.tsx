"use client";

import { Help } from "@openstatus/icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
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
import {
  HELP_ASK_AGENT,
  HELP_CONNECT_AGENT,
  HELP_LINKS,
  HELP_SUPPORT,
} from "@/config/help";
import { useCopyAgentPrompt } from "@/hooks/use-copy-agent-prompt";

export function NavHelp() {
  const { isMobile } = useSidebar();
  const { copyPrompt } = useCopyAgentPrompt("ask", "help");
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
                className="w-52 rounded-lg"
                side={isMobile ? "bottom" : "right"}
                align="end"
                sideOffset={4}
              >
                <DropdownMenuLabel className="text-muted-foreground text-xs">
                  Agents
                </DropdownMenuLabel>
                <DropdownMenuItem onSelect={() => void copyPrompt()}>
                  <HELP_ASK_AGENT.icon />
                  {HELP_ASK_AGENT.label}
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={HELP_CONNECT_AGENT.href}>
                    <HELP_CONNECT_AGENT.icon />
                    {HELP_CONNECT_AGENT.label}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-muted-foreground text-xs">
                  Get Help
                </DropdownMenuLabel>
                <FormDialogSupportContact>
                  <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                    <HELP_SUPPORT.icon />
                    {HELP_SUPPORT.label}
                  </DropdownMenuItem>
                </FormDialogSupportContact>
                {HELP_LINKS.map((item) => (
                  <DropdownMenuItem key={item.label} asChild>
                    <Link href={item.href} target="_blank" rel="noreferrer">
                      <item.icon />
                      {item.label}
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
