"use client";

import { StatusPage } from "@openstatus/icons";
import { useQuery } from "@tanstack/react-query";
import { useParams, usePathname } from "next/navigation";

import { NavBreadcrumb } from "@/components/nav/nav-breadcrumb";
import { useHydrated } from "@/hooks/use-hydrated";
import { useTRPC } from "@/lib/trpc/client";

import { STATUS_PAGE_TABS } from "./constants";

export function Breadcrumb() {
  // The entity crumb depends on data the page hydrates after this layout
  // streamed, so it is only rendered on the client.
  const hydrated = useHydrated();
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
  const onDetail = reportId !== undefined || maintenanceId !== undefined;
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
        // on a detail route the tab links back to its list even before the
        // entity resolves
        ...(currentTab
          ? onDetail
            ? [
                {
                  type: "link" as const,
                  label: currentTab.label,
                  href: `/status-pages/${id}/${currentTab.value}`,
                  icon: currentTab.icon,
                },
                ...(entity ? [{ type: "page" as const, label: entity }] : []),
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
