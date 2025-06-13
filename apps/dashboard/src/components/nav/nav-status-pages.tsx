"use client";

import { MoreHorizontal, Plus } from "lucide-react";

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import Link from "next/link";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useRouter } from "next/navigation";
import { getActions } from "@/data/status-pages.client";
import { QuickActions } from "@/components/dropdowns/quick-actions";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import type { StatusPage } from "@/data/status-pages";

const STATUS = {
  operational: "bg-success",
  degraded: "bg-warning",
  outage: "bg-degraded",
};

export function NavStatusPages({ statusPages }: { statusPages: StatusPage[] }) {
  const { isMobile, setOpenMobile } = useSidebar();
  const router = useRouter();
  const actions = getActions({
    edit: () => router.push("/dashboard/status-pages/edit"),
    "copy-id": () => {
      navigator.clipboard.writeText("ID");
      toast.success("Status Page ID copied to clipboard");
    },
  });

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel className="flex items-center justify-between pr-1">
        <span>
          Status Pages{" "}
          <code className="text-muted-foreground">({statusPages.length})</code>
        </span>
        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <SidebarMenuAction
                  className="relative top-0 right-0 border"
                  onClick={() => {
                    router.push("/dashboard/status-pages/create");
                    setOpenMobile(false);
                  }}
                >
                  <Plus className="text-muted-foreground" />
                  <span className="sr-only">Create Status Page</span>
                </SidebarMenuAction>
              </TooltipTrigger>
              <TooltipContent side="right" align="center">
                Create Status Page
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </SidebarGroupLabel>
      <SidebarMenu>
        {statusPages.map((item) => {
          // NOTE: once you have a router, you can use it to check if the item is active
          return (
            <SidebarMenuItem key={item.name}>
              <SidebarMenuButton
                className="group-has-data-[sidebar=menu-dot]/menu-item:pr-11"
                asChild
              >
                <Link
                  href={"/dashboard/status-pages/status-reports"}
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
                      STATUS[item.status]
                    )}
                  />
                </div>
              </div>
              <QuickActions
                actions={actions}
                deleteAction={{
                  title: "Monitor",
                  confirmationValue: "delete monitor",
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
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}
