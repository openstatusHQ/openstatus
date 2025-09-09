"use client";

import { useStatusPage } from "@/components/status-page/floating-button";
import {
  Status,
  StatusBanner,
  StatusContent,
  StatusDescription,
  StatusHeader,
  StatusTitle,
} from "@/components/status-page/status";
import { StatusFeed } from "@/components/status-page/status-feed";
import { StatusMonitor } from "@/components/status-page/status-monitor";
import { Separator } from "@/components/ui/separator";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { subDays } from "date-fns";
import { useParams } from "next/navigation";

export default function Page() {
  const { domain } = useParams<{ domain: string }>();
  const { cardType, barType, showUptime } = useStatusPage();
  const trpc = useTRPC();
  const { data: page } = useQuery(
    trpc.statusPage.get.queryOptions({ slug: domain }),
  );
  // NOTE: we can prefetch that to avoid loading state
  const { data: uptimeData, isLoading } = useQuery(
    trpc.statusPage.getUptime.queryOptions({
      slug: domain,
      monitorIds: page?.monitors?.map((monitor) => monitor.id.toString()) || [],
      // NOTE: this will be moved to db config
      cardType,
      barType,
    }),
  );

  if (!page) return null;

  return (
    <div className="flex flex-col gap-6">
      <Status variant={page.status}>
        <StatusHeader>
          <StatusTitle>{page.title}</StatusTitle>
          <StatusDescription>{page.description}</StatusDescription>
        </StatusHeader>
        <StatusBanner />
        {/* TODO: check how to display current events */}
        <StatusContent>
          {page.monitors.map((monitor) => {
            const { data, uptime } =
              uptimeData?.find((m) => m.id === monitor.id) ?? {};
            return (
              <StatusMonitor
                key={monitor.id}
                status={monitor.status}
                data={data}
                monitor={monitor}
                uptime={uptime}
                showUptime={showUptime}
                isLoading={isLoading}
              />
            );
          })}
        </StatusContent>
        <Separator />
        <StatusContent>
          <StatusTitle>Recent Events</StatusTitle>
          <StatusFeed
            statusReports={page.statusReports
              .filter((report) => {
                const isRecent = report.statusReportUpdates.some(
                  (update) =>
                    update.date.getTime() > subDays(new Date(), 7).getTime(),
                );
                const isOpen = !report.statusReportUpdates.some(
                  (update) =>
                    update.status === "monitoring" ||
                    update.status === "resolved",
                );
                return isRecent || isOpen;
              })
              .map((report) => ({
                ...report,
                affected: report.monitorsToStatusReports.map(
                  (monitor) => monitor.monitor.name,
                ),
                updates: report.statusReportUpdates,
              }))}
            maintenances={page.maintenances
              .filter((maintenance) => {
                const isRecent =
                  maintenance.from.getTime() > subDays(new Date(), 7).getTime();
                return isRecent;
              })
              .map((maintenance) => ({
                ...maintenance,
                affected: maintenance.maintenancesToMonitors.map(
                  (monitor) => monitor.monitor.name,
                ),
              }))}
          />
        </StatusContent>
      </Status>
    </div>
  );
}
