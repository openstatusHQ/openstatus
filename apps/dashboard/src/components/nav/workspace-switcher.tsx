"use client";

import { ChevronsUpDown, Plus } from "lucide-react";

import { Link } from "@/components/common/link";
import { useTRPC } from "@/lib/trpc/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@openstatus/ui/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@openstatus/ui/components/ui/sidebar";
import { cn } from "@openstatus/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";

interface WorkspaceSwitcherProps {
  className?: string;
  side?: React.ComponentProps<typeof DropdownMenuContent>["side"];
}

export function WorkspaceSwitcher({ className, side }: WorkspaceSwitcherProps) {
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
              className={cn(
                "h-14 rounded-none px-4 ring-inset data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground group-data-[collapsible=icon]:mx-2! group-data-[collapsible=icon]:rounded-lg! group-data-[collapsible=icon]:px-0!",
                className,
              )}
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
                  <span className="font-commit-mono tracking-tight">
                    {workspace.slug}
                  </span>{" "}
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
            side={side ?? (isMobile ? "bottom" : "right")}
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
                <Plus />
                <div className="font-commit-mono text-muted-foreground tracking-tight">
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
