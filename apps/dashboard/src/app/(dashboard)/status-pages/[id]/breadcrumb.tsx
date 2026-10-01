"use client";

import { StatusPage } from "@openstatus/icons";
import { useQuery } from "@tanstack/react-query";
import { useParams, usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";

import { NavBreadcrumb } from "@/components/nav/nav-breadcrumb";
import { useTRPC } from "@/lib/trpc/client";

import { STATUS_PAGE_TABS } from "./constants";

const subscribe = () => () => {};

export function Breadcrumb() {
  // The entity crumb depends on data the page hydrates after this layout
  // streamed, so it is only rendered on the client.
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const { id, reportId, maintenanceId } = useParams<{
    id: string;
    reportId?: string;
    maintenanceId?: string;
  }>();
  const pathname = usePathname();
  const trpc = useTRPC();
  const { data: statusPage } = useQuery(
    trpc.page.get.queryOptions({ id: Number.parseInt(id) }),
  );
  const { data: report } = useQuery({
    ...trpc.statusReport.get.queryOptions({ id: Number(reportId) }),
    enabled: reportId !== undefined,
  });
  const { data: maintenance } = useQuery({
    ...trpc.maintenance.get.queryOptions({ id: Number(maintenanceId) }),
    enabled: maintenanceId !== undefined,
  });

  if (!statusPage) return null;

  const segments = pathname.split("/");
  const currentTab = STATUS_PAGE_TABS.find((tab) =>
    segments.includes(tab.value),
  );
  const entity = hydrated ? (report?.title ?? maintenance?.title) : undefined;

  return (
    <NavBreadcrumb
      items={[
        {
          type: "link",
          label: "Status Pages",
          href: "/status-pages",
          icon: StatusPage,
        },
        {
          type: "link",
          label: statusPage.title,
          href: `/status-pages/${id}`,
        },
        ...(currentTab
          ? entity
            ? [
                {
                  type: "link" as const,
                  label: currentTab.label,
                  href: `/status-pages/${id}/${currentTab.value}`,
                  icon: currentTab.icon,
                },
                { type: "page" as const, label: entity },
              ]
            : [
                {
                  type: "page" as const,
                  label: currentTab.label,
                  icon: currentTab.icon,
                },
              ]
          : []),
      ]}
    />
  );
}
