"use client";

import { MoreHorizontal, Plus } from "lucide-react";

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
import { getActions } from "@/data/status-pages.client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";

import { UpgradeDialog } from "@/components/dialogs/upgrade";
import { Skeleton } from "@/components/ui/skeleton";
import { useTRPC } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

const STATUS = {
  operational: "bg-success border border-success",
  degraded: "bg-warning border border-warning",
  outage: "bg-destructive border border-destructive",
};

export function NavStatusPages() {
  const { isMobile, setOpenMobile } = useSidebar();
  const [openUpgradeDialog, setOpenUpgradeDialog] = useState(false);
  const pathname = usePathname();
  const trpc = useTRPC();
  const router = useRouter();
  const {
    data: statusPages,
    refetch,
    isLoading,
  } = useQuery(trpc.page.list.queryOptions());
  const { data: workspace } = useQuery(trpc.workspace.get.queryOptions());
  const queryClient = useQueryClient();
  const deleteStatusPage = useMutation(
    trpc.page.delete.mutationOptions({
      onSuccess: () => {
        refetch();
        queryClient.invalidateQueries({
          queryKey: trpc.workspace.get.queryKey(),
        });
      },
    }),
  );

  if (!workspace || !statusPages) return null;

  const limitReached = statusPages.length >= workspace.limits["status-pages"];

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel className="flex items-center justify-between pr-1">
        <div className="flex items-center gap-1">
          <span>Status Pages</span>
          {isLoading ? (
            <Skeleton className="h-4 w-5 shrink-0" />
          ) : (
            <code className="text-muted-foreground">
              ({statusPages?.length})
            </code>
          )}
        </div>
        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <SidebarMenuAction
                  data-disabled={limitReached}
                  className="relative top-0 right-0 border data-[disabled=true]:opacity-50"
                  onClick={() => {
                    if (limitReached) {
                      setOpenUpgradeDialog(true);
                      return;
                    }
                    router.push("/status-pages/create");
                    setOpenMobile(false);
                  }}
                >
                  <Plus className="text-muted-foreground" />
                  <span className="sr-only">Create Status Page</span>
                </SidebarMenuAction>
              </TooltipTrigger>
              <TooltipContent side="right" align="center">
                {limitReached ? "Upgrade" : "Create Status Page"}
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
        ) : statusPages && statusPages.length > 0 ? (
          statusPages.map((item) => {
            const isActive = pathname.startsWith(`/status-pages/${item.id}/`);
            const actions = getActions({
              edit: () => router.push(`/status-pages/${item.id}/edit`),
              "copy-id": () => {
                navigator.clipboard.writeText("ID");
                toast.success("Status Page ID copied to clipboard");
              },
            });
            const hasActiveStatusReport = item.statusReports.some(
              (report) => report.status !== "resolved",
            );

            return (
              <SidebarMenuItem key={item.id}>
                <SidebarMenuButton
                  className="group-has-data-[sidebar=menu-dot]/menu-item:pr-11"
                  isActive={isActive}
                  asChild
                >
                  <Link
                    href={`/status-pages/${item.id}/status-reports`}
                    onClick={() => setOpenMobile(false)}
                  >
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
                <div
                  data-sidebar="menu-dot"
                  className={cn(
                    "absolute top-1.5 right-1 flex h-2.5 items-center justify-center p-2.5 transition-all duration-200 group-focus-within/menu-item:right-6 group-hover/menu-action:right-6 group-hover/menu-item:right-6 group-data-[state=open]/menu-action:right-6 [&:has(+[data-sidebar=menu-action][data-state=open])]:right-6",
                    isMobile && "right-6",
                  )}
                >
                  <div className="relative flex items-center justify-center">
                    <div
                      className={cn(
                        "-translate-x-1/2 -translate-y-1/2 absolute top-1/2 left-1/2 h-2 w-2 rounded-full",
                        STATUS[
                          hasActiveStatusReport ? "degraded" : "operational"
                        ],
                      )}
                    />
                  </div>
                </div>
                <QuickActions
                  actions={actions}
                  deleteAction={{
                    title: "Status Page",
                    confirmationValue: "delete status page",
                    submitAction: async () => {
                      await deleteStatusPage.mutateAsync({ id: item.id });
                      if (pathname.includes(`/status-pages/${item.id}`)) {
                        router.push("/status-pages");
                      }
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
              <span>No status pages found</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        )}
      </SidebarMenu>
      <UpgradeDialog
        open={openUpgradeDialog}
        onOpenChange={setOpenUpgradeDialog}
      />
    </SidebarGroup>
  );
}
