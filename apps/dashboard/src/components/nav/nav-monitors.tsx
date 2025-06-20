"use client";

import React, { useState } from "react";

import { MoreHorizontal, Plus } from "lucide-react";

import { ExportCodeDialog } from "@/components/dialogs/export-code";
import { QuickActions } from "@/components/dropdowns/quick-actions";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getActions } from "@/data/monitors.client";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc/client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";

const STATUS = {
  Degraded: "bg-warning border border-warning",
  Failing: "bg-destructive border border-destructive",
  Inactive: "bg-muted-foreground border border-muted-foreground",
  Normal: "bg-success border border-success",
};

export function NavMonitors() {
  const [openDialog, setOpenDialog] = useState(false);
  const { isMobile, setOpenMobile } = useSidebar();
  const trpc = useTRPC();
  const router = useRouter();
  const pathname = usePathname();
  const {
    data: monitors,
    isLoading,
    refetch,
  } = useQuery(trpc.monitor.list.queryOptions());
  const { data: workspace } = useQuery(trpc.workspace.get.queryOptions());
  const deleteMonitorMutation = useMutation(
    trpc.monitor.delete.mutationOptions({
      onSuccess: () => refetch(),
    })
  );

  if (!workspace || !monitors) return null;

  const limitReached = monitors.length >= workspace.limits["monitors"];

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel
        className="flex items-center justify-between pr-1"
        style={{ paddingRight: 4 }}
      >
        <div className="flex items-center gap-1">
          <span>Monitors</span>
          {isLoading ? (
            <Skeleton className="h-4 w-5 shrink-0" />
          ) : (
            <code className="text-muted-foreground">({monitors.length})</code>
          )}
        </div>
        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <SidebarMenuAction
                  disabled={limitReached}
                  data-disabled={limitReached}
                  className="relative top-0 right-0 border data-[disabled=true]:opacity-50"
                  onClick={() => {
                    router.push("/monitors/create");
                    setOpenMobile(false);
                  }}
                >
                  <Plus className="text-muted-foreground" />
                  <span className="sr-only">Create Monitor</span>
                </SidebarMenuAction>
              </TooltipTrigger>
              <TooltipContent side="right" align="center">
                {limitReached ? "Upgrade" : "Create Monitor"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </SidebarGroupLabel>
      <SidebarMenu>
        {isLoading ? (
          <SidebarMenuItem>
            <SidebarMenuSkeleton />
          </SidebarMenuItem>
        ) : monitors && monitors.length > 0 ? (
          monitors.map((item) => {
            const isActive = pathname.startsWith(`/monitors/${item.id}`);
            const actions = getActions({
              edit: () => router.push(`/monitors/${item.id}/edit`),
              "copy-id": () => {
                navigator.clipboard.writeText("ID");
                toast.success("Monitor ID copied to clipboard");
              },
              export: () => setOpenDialog(true),
            });
            return (
              <SidebarMenuItem key={item.name}>
                <SidebarMenuButton
                  className="group-has-data-[sidebar=menu-dot]/menu-item:pr-11"
                  isActive={isActive}
                  asChild
                >
                  <Link
                    href={`/monitors/${item.id}/overview`}
                    onClick={() => setOpenMobile(false)}
                  >
                    <span>{item.name}</span>
                  </Link>
                </SidebarMenuButton>
                <div
                  data-sidebar="menu-dot"
                  className={cn(
                    "absolute top-1.5 right-1 flex h-2.5 items-center justify-center p-2.5 transition-all duration-200 group-focus-within/menu-item:right-6 group-hover/menu-action:right-6 group-hover/menu-item:right-6 group-data-[state=open]/menu-action:right-6 [&:has(+[data-sidebar=menu-action][data-state=open])]:right-6",
                    isMobile && "right-6"
                  )}
                >
                  <div className="relative flex items-center justify-center">
                    <div
                      className={cn(
                        "-translate-x-1/2 -translate-y-1/2 absolute top-1/2 left-1/2 h-2 w-2 rounded-full",
                        STATUS["Normal"]
                      )}
                    >
                      <span className="sr-only">{item.status}</span>
                    </div>
                  </div>
                </div>
                <QuickActions
                  actions={actions}
                  deleteAction={{
                    title: "Monitor",
                    confirmationValue: "delete monitor",
                    submitAction: async () => {
                      await deleteMonitorMutation.mutateAsync({
                        id: item.id,
                      });
                    },
                  }}
                  side={isMobile ? "bottom" : "right"}
                  align={isMobile ? "end" : "start"}
                >
                  <SidebarMenuAction showOnHover>
                    <MoreHorizontal />
                    <span className="sr-only">More</span>
                  </SidebarMenuAction>
                </QuickActions>
              </SidebarMenuItem>
            );
          })
        ) : (
          <SidebarMenuItem>
            <SidebarMenuButton disabled>
              <span>No monitors found</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        )}
      </SidebarMenu>
      <ExportCodeDialog open={openDialog} onOpenChange={setOpenDialog} />
    </SidebarGroup>
  );
}
