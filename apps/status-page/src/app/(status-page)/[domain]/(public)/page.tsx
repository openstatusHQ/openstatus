"use client";

import { useStatusPage } from "@/components/status-page/floating-button";
import {
  Status,
  StatusContent,
  StatusDescription,
  StatusHeader,
  StatusTitle,
} from "@/components/status-page/status";
import {
  StatusBanner,
  StatusBannerContainer,
  StatusBannerContent,
  StatusBannerTabs,
  StatusBannerTabsContent,
  StatusBannerTabsList,
  StatusBannerTabsTrigger,
} from "@/components/status-page/status-banner";
import {
  StatusEventTimelineMaintenance,
  StatusEventTimelineReport,
} from "@/components/status-page/status-events";
import { StatusFeed } from "@/components/status-page/status-feed";
import { StatusMonitor } from "@/components/status-page/status-monitor";
import { StatusTrackerGroup } from "@/components/status-page/status-tracker-group";
import { Separator } from "@/components/ui/separator";
import { useTRPC } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { notFound, useParams } from "next/navigation";
import { useMemo } from "react";

export default function Page() {
  const { domain } = useParams<{ domain: string }>();
  const { cardType, barType, showUptime } = useStatusPage();
  const trpc = useTRPC();

  // NOTE: we cannot use `cardType` and `barType` here because of queryKey changes
  // It wouldn't match the server prefetch keys and we would have to refetch the page here
  const { data: pageInitial, error } = useQuery({
    ...trpc.statusPage.get.queryOptions({
      slug: domain,
    }),
    enabled: !!domain,
  });

  // Handle case where page doesn't exist or query fails
  if (error || (!pageInitial && domain)) {
    notFound();
  }

  const hasCustomConfig = pageInitial?.configuration
    ? pageInitial.configuration.type !== barType ||
      pageInitial.configuration.value !== cardType
    : false;

  // NOTE: instead, we use the `enabled` flag to only fetch the page if the configuration differs
  const { data: pageWithCustomConfiguration } = useQuery({
    ...trpc.statusPage.get.queryOptions({
      slug: domain,
      cardType,
      barType,
    }),
    enabled: !!domain && hasCustomConfig,
  });

  // NOTE: we can prefetch that to avoid loading state
  const { data: uptimeData, isLoading } = useQuery({
    ...trpc.statusPage.getUptime.queryOptions({
      slug: domain,
      monitorIds:
        pageInitial?.monitors?.map((monitor) => monitor.id.toString()) || [],
      cardType,
      barType,
    }),
    enabled: !!pageInitial && pageInitial.monitors.length > 0,
  });

  // NOTE: we need to filter out the incidents as we don't want to show all of them in the banner - a single one is enough
  // REMINDER: we could move that to the server - but we might wanna have the info of all openEvents actually
  const events = useMemo(() => {
    let hasIncident = false;
    return (
      pageInitial?.openEvents.filter((e) => {
        if (e.type !== "incident") return true;
        if (hasIncident) return false;
        hasIncident = true;
        return true;
      }) ?? []
    );
  }, [pageInitial]);

  if (!pageInitial) return null;

  // REMINDER: if we are using the custom configuration, we need to use the pageWithCustomConfiguration
  const page = pageWithCustomConfiguration ?? pageInitial;

  const firstGroupIndex = useMemo(
    () => page.trackers.findIndex((tracker) => tracker.type === "group"),
    [page.trackers],
  );

  return (
    <div className="flex flex-col gap-6">
      <Status variant={page.status}>
        <StatusHeader>
          <StatusTitle>{page.title}</StatusTitle>
          <StatusDescription>{page.description}</StatusDescription>
        </StatusHeader>
        {events.length > 0 ? (
          <StatusContent>
            <StatusBannerTabs
              defaultValue={`${events[0].type}-${events[0].id}`}
            >
              <StatusBannerTabsList>
                {events.map((e, i) => {
                  return (
                    <StatusBannerTabsTrigger
                      value={`${e.type}-${e.id}`}
                      status={e.status}
                      key={`${e.type}-${e.id}`}
                      className={cn(
                        i === 0 && "rounded-tl-lg",
                        i === events.length - 1 && "rounded-tr-lg",
                      )}
                    >
                      {e.name}
                    </StatusBannerTabsTrigger>
                  );
                })}
              </StatusBannerTabsList>
              {events.map((e) => {
                if (e.type === "report") {
                  const report = page.statusReports.find(
                    (report) => report.id === e.id,
                  );
                  if (!report) return null;
                  return (
                    <StatusBannerTabsContent
                      value={`${e.type}-${e.id}`}
                      key={`${e.type}-${e.id}`}
                    >
                      <StatusBannerContainer status={e.status}>
                        <StatusBannerContent>
                          <StatusEventTimelineReport
                            updates={report.statusReportUpdates}
                            withDot={false}
                            maxUpdates={3}
                          />
                        </StatusBannerContent>
                      </StatusBannerContainer>
                    </StatusBannerTabsContent>
                  );
                }
                if (e.type === "maintenance") {
                  const maintenance = page.maintenances.find(
                    (maintenance) => maintenance.id === e.id,
                  );
                  if (!maintenance) return null;
                  return (
                    <StatusBannerTabsContent
                      value={`${e.type}-${e.id}`}
                      key={e.id}
                    >
                      <StatusBannerContainer status={e.status}>
                        <StatusBannerContent>
                          <StatusEventTimelineMaintenance
                            maintenance={maintenance}
                            withDot={false}
                          />
                        </StatusBannerContent>
                      </StatusBannerContainer>
                    </StatusBannerTabsContent>
                  );
                }
                if (e.type === "incident") {
                  return (
                    <StatusBannerTabsContent
                      value={`${e.type}-${e.id}`}
                      key={e.id}
                    >
                      <StatusBanner status={e.status} />
                    </StatusBannerTabsContent>
                  );
                }
                return null;
              })}
            </StatusBannerTabs>
          </StatusContent>
        ) : (
          <StatusBanner status={page.status} />
        )}
        {/* NOTE: check what gap feels right */}
        {page.trackers.length > 0 ? (
          <StatusContent className="gap-5">
            {page.trackers.map((tracker, index) => {
              if (tracker.type === "monitor") {
                const monitor = tracker.monitor;
                const { data, uptime } =
                  uptimeData?.find((m) => m.id === monitor.id) ?? {};
                return (
                  <StatusMonitor
                    key={`monitor-${monitor.id}`}
                    status={monitor.status}
                    data={data}
                    monitor={monitor}
                    uptime={uptime}
                    showUptime={showUptime}
                    isLoading={isLoading}
                  />
                );
              }

              return (
                <StatusTrackerGroup
                  key={`group-${tracker.groupId}`}
                  title={tracker.groupName}
                  status={tracker.status}
                  // NOTE: we only want to open the first group if it is the first one
                  defaultOpen={firstGroupIndex === index && index === 0}
                >
                  {tracker.monitors.map((monitor) => {
                    const { data, uptime } =
                      uptimeData?.find((m) => m.id === monitor.id) ?? {};
                    return (
                      <StatusMonitor
                        key={`monitor-${monitor.id}`}
                        status={monitor.status}
                        data={data}
                        monitor={monitor}
                        uptime={uptime}
                        showUptime={showUptime}
                        isLoading={isLoading}
                      />
                    );
                  })}
                </StatusTrackerGroup>
              );
            })}
          </StatusContent>
        ) : null}
        <Separator />
        <StatusContent>
          <StatusFeed
            statusReports={page.statusReports
              .filter((report) =>
                page.lastEvents.some(
                  (event) => event.id === report.id && event.type === "report",
                ),
              )
              .map((report) => ({
                ...report,
                affected: report.monitorsToStatusReports.map(
                  (monitor) => monitor.monitor.name,
                ),
                updates: report.statusReportUpdates,
              }))}
            maintenances={page.maintenances
              .filter((maintenance) =>
                page.lastEvents.some(
                  (event) =>
                    event.id === maintenance.id && event.type === "maintenance",
                ),
              )
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
