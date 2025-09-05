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
// import { StatusTrackerGroup } from "@/components/status-page/status-tracker-group";
// import { chartData } from "@/components/status-page/utils";
// import { monitors } from "@/data/monitors";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { Newspaper } from "lucide-react";
import { useParams } from "next/navigation";
import { useCallback } from "react";

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
  const { variant, cardType, barType, showUptime } = useStatusPage();

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
            to: lastUpdate?.status === "resolved" ? lastUpdate?.date : null,
          };
        });

      // TODO: move the logic in here!

      return {
        maintenances,
        incidents,
        reports,
      };
    },
    [page],
  );

  if (!page) return null;

  return (
    <div className="flex flex-col gap-6">
      <Status variant={variant}>
        <StatusHeader>
          <StatusTitle>{page.title}</StatusTitle>
          <StatusDescription>{page.description}</StatusDescription>
        </StatusHeader>
        <StatusBanner />
        <StatusContent>
          {page.monitors.map((monitor) => {
            const events = getEvents(monitor.id);
            return (
              <StatusMonitor
                key={monitor.id}
                variant={variant}
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
