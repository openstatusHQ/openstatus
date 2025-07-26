"use client";

import { ChevronsUpDown, Plus } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { Link } from "../common/link";

export function WorkspaceSwitcher() {
  const { isMobile, setOpenMobile } = useSidebar();
  const trpc = useTRPC();
  const { data: workspace } = useQuery(trpc.workspace.get.queryOptions());
  const { data: workspaces } = useQuery(trpc.workspace.list.queryOptions());

  if (!workspace) return null;

  function handleClick(slug: string) {
    document.cookie = `workspace-slug=${slug}; path=/;`;
    window.location.href = "/overview";
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              // FIXME: group-data-[collapsible=icon]:mx-8! (incl. nav-user)
              className="h-14 rounded-none px-4 ring-inset data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground group-data-[collapsible=icon]:mx-2!"
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary">
                <div className="size-8 overflow-hidden rounded-lg">
                  <img
                    src={`https://api.dicebear.com/9.x/glass/svg?seed=${workspace.slug}`}
                    alt="avatar"
                  />
                </div>
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <div className="truncate font-medium">
                  {workspace.name || "Untitled Workspace"}
                </div>
                <div className="truncate text-xs">
                  <span className="font-mono">{workspace.slug}</span>{" "}
                  <span className="text-muted-foreground">
                    {workspace.plan === "team" ? "pro" : workspace.plan}
                  </span>
                </div>
              </div>
              <ChevronsUpDown className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-muted-foreground text-xs">
              Workspaces
            </DropdownMenuLabel>
            {workspaces?.map((workspace) => (
              <DropdownMenuItem
                key={workspace.id}
                onClick={() => {
                  handleClick(workspace.slug);
                  setOpenMobile(false);
                }}
                className="gap-2 p-2"
              >
                <span className="truncate">
                  {workspace.name || "Untitled Workspace"}
                </span>
                <span className="truncate font-mono text-muted-foreground text-xs">
                  {workspace.slug}
                </span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 p-2" asChild>
              <Link href="/settings/general">
                <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
                  <Plus className="size-4" />
                </div>
                <div className="font-medium text-muted-foreground">
                  Add team member
                </div>
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
