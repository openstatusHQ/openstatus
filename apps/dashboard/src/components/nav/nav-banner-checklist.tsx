"use client";

import { ArrowUpRight, Success, Pending, Close } from "@openstatus/icons";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuItem,
} from "@openstatus/ui/components/ui/sidebar";
import { useQuery } from "@tanstack/react-query";

import { Link } from "@/components/common/link";
import { useTRPC } from "@/lib/trpc/client";

export function NavBannerChecklist({
  handleClose,
}: {
  handleClose: () => void;
}) {
  const trpc = useTRPC();
  const { data: workspace } = useQuery(trpc.workspace.get.queryOptions());
  const { data: pages } = useQuery(trpc.page.list.queryOptions());

  if (!workspace) return null;

  const onlyPage = pages?.length === 1 ? pages[0] : undefined;

  const hasMonitors = (workspace.usage?.monitors ?? 0) > 0;
  const hasStatusPages = (workspace.usage?.pages ?? 0) > 0;
  const hasPageComponents = (workspace.usage?.pageComponents ?? 0) > 0;
  const hasNotifications = (workspace.usage?.notifications ?? 0) > 0;
  const hasStatusReports = (workspace.usage?.statusReports ?? 0) > 0;

  const items = [
    {
      title: "Create Monitor",
      checked: hasMonitors,
      href: "/monitors/create",
    },
    {
      title: "Create Status Page",
      checked: hasStatusPages,
      href: "/status-pages/create",
    },
    {
      title: "Add Page Components",
      checked: hasPageComponents,
      href: onlyPage
        ? `/status-pages/${onlyPage.id}/components`
        : "/status-pages",
    },
    {
      title: "Create Status Report",
      checked: hasStatusReports,
      href: onlyPage
        ? `/status-pages/${onlyPage.id}/status-reports`
        : "/status-pages",
    },
    {
      title: "Create Notification",
      checked: hasNotifications,
      href: "/notifications",
    },
  ];

  if (items.every((i) => i.checked)) return null;

  return (
    <SidebarGroup className="bg-background rounded-lg border group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel className="flex items-center justify-between pr-1">
        <span>
          Getting Started ({items.filter((i) => i.checked).length}/
          {items.length})
        </span>
        <SidebarMenuAction
          className="relative top-0 right-0"
          onClick={handleClose}
        >
          <Close className="text-muted-foreground" size={16} />
        </SidebarMenuAction>
      </SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => (
          <SidebarMenuItem
            key={item.title}
            className="flex items-center gap-2 text-sm"
          >
            {item.checked ? (
              <>
                <Success className="text-success shrink-0" size={12} />
                <span>{item.title}</span>
              </>
            ) : (
              <>
                <Pending
                  className="text-muted-foreground/50 shrink-0"
                  size={12}
                />
                <Link href={item.href}>{item.title}</Link>
              </>
            )}
          </SidebarMenuItem>
        ))}
        <SidebarMenuItem className="flex items-center gap-2 text-sm">
          <ArrowUpRight
            className="text-muted-foreground/50 shrink-0"
            size={12}
          />
          <a
            href="https://www.openstatus.dev/docs"
            target="_blank"
            rel="noopener noreferrer"
          >
            Read the Docs
          </a>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroup>
  );
}
