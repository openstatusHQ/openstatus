"use client";

import { useStatusPage } from "@/components/status-page/floating-button";
import {
  Status,
  StatusBanner,
  StatusContent,
  StatusDescription,
  StatusEmptyState,
  StatusEmptyStateDescription,
  StatusEmptyStateTitle,
  StatusHeader,
  StatusTitle,
} from "@/components/status-page/status";
import { StatusMonitor } from "@/components/status-page/status-monitor";
import { getHighestStatus } from "@/components/status-page/utils";
// import { StatusTrackerGroup } from "@/components/status-page/status-tracker-group";
// import { chartData } from "@/components/status-page/utils";
// import { monitors } from "@/data/monitors";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { isWithinInterval } from "date-fns";
import { Newspaper } from "lucide-react";
import { useParams } from "next/navigation";
import { useCallback, useMemo } from "react";

export default function Page() {
  const { domain } = useParams<{ domain: string }>();
  const trpc = useTRPC();
  const { data: page } = useQuery(
    trpc.statusPage.get.queryOptions({ slug: domain }),
  );
  const { data: status } = useQuery(
    trpc.statusPage.getStatus.queryOptions({
      slug: domain,
      monitorIds: page?.monitors.map((monitor) => monitor.id.toString()) || [],
    }),
  );
  const { cardType, barType, showUptime } = useStatusPage();

  const getEvents = useCallback(
    (monitorId: number) => {
      const maintenances = page?.maintenances
        .filter((maintenance) =>
          maintenance.maintenancesToMonitors.some(
            (m) => m.monitorId === monitorId,
          ),
        )
        .map((maintenance) => ({
          id: maintenance.id,
          name: maintenance.title,
          from: maintenance.from,
          to: maintenance.to,
        }));
      const incidents = page?.incidents
        .filter((incident) => incident.monitorId === monitorId)
        .map((incident) => ({
          id: incident.id,
          name: incident.title,
          from: incident.createdAt,
          to: incident.resolvedAt,
        }));
      const reports = page?.statusReports
        .filter((report) =>
          report.monitorsToStatusReports.some((m) => m.monitorId === monitorId),
        )
        .map((report) => {
          const updates = report.statusReportUpdates.sort(
            (a, b) => a.date.getTime() - b.date.getTime(),
          );
          const firstUpdate = updates[0];
          const lastUpdate = updates[updates.length - 1];
          return {
            id: report.id,
            name: report.title,
            from: firstUpdate?.date,
            to:
              lastUpdate?.status === "resolved" ||
              lastUpdate?.status === "monitoring"
                ? lastUpdate?.date
                : null,
          };
        });

      const status = incidents?.some((incident) => incident.to === null)
        ? ("error" as const)
        : reports?.some((report) => report.to === null)
          ? ("degraded" as const)
          : maintenances?.some((maintenance) =>
                isWithinInterval(new Date(), {
                  start: maintenance.from,
                  end: maintenance.to,
                }),
              )
            ? ("info" as const)
            : ("success" as const);

      return {
        maintenances,
        incidents,
        reports,
        status,
      };
    },
    [page],
  );

  const monitors = useMemo(() => {
    return (
      page?.monitors.map((monitor) => ({
        ...monitor,
        data: getEvents(monitor.id),
      })) ?? []
    );
  }, [page, getEvents]);

  if (!page) return null;

  return (
    <div className="flex flex-col gap-6">
      <Status
        variant={getHighestStatus(
          monitors.map((monitor) => monitor.data.status),
        )}
      >
        <StatusHeader>
          <StatusTitle>{page.title}</StatusTitle>
          <StatusDescription>{page.description}</StatusDescription>
        </StatusHeader>
        <StatusBanner />
        <StatusContent>
          {monitors.map((monitor) => {
            const events = monitor.data;
            return (
              <StatusMonitor
                key={monitor.id}
                variant={events.status}
                cardType={cardType}
                barType={barType}
                data={
                  status
                    ?.find((m) => m.id === monitor.id)
                    ?.data.map((item) => ({
                      ...item,
                      success: item.ok,
                      info: 0,
                      timestamp: new Date(item.day).getTime(),
                    })) || []
                }
                monitor={monitor}
                showUptime={showUptime}
                maintenances={events.maintenances}
                incidents={events.incidents}
                reports={events.reports}
              />
            );
          })}
          {/* <StatusMonitor
            variant={variant}
            cardType={cardType}
            barType={barType}
            data={chartData}
            monitor={monitors[1]}
            showUptime={showUptime}
          />
          <StatusTrackerGroup title="US Endpoints" variant={variant}>
            <StatusMonitor
              variant={variant}
              cardType={cardType}
              barType={barType}
              data={chartData}
              monitor={monitors[0]}
              showUptime={showUptime}
            />
            <StatusMonitor
              variant={variant}
              cardType={cardType}
              barType={barType}
              data={chartData}
              monitor={monitors[1]}
              showUptime={showUptime}
            />
          </StatusTrackerGroup>
          <StatusTrackerGroup title="EU Endpoints" variant={variant}>
            <StatusMonitor
              variant={variant}
              cardType={cardType}
              barType={barType}
              data={chartData}
              monitor={monitors[0]}
              showUptime={showUptime}
            />
            <StatusMonitor
              variant={variant}
              cardType={cardType}
              barType={barType}
              data={chartData}
              monitor={monitors[1]}
              showUptime={showUptime}
            />
          </StatusTrackerGroup> */}
        </StatusContent>
        <StatusContent>
          <StatusEmptyState>
            <Newspaper className="size-4 text-muted-foreground" />
            <StatusEmptyStateTitle>No recent reports</StatusEmptyStateTitle>
            <StatusEmptyStateDescription>
              There have been no reports within the last 7 days.
            </StatusEmptyStateDescription>
          </StatusEmptyState>
        </StatusContent>
      </Status>
    </div>
  );
}
