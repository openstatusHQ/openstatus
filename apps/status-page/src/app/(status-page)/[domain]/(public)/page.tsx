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
  StatusEventAffected,
  StatusEventAffectedBadge,
  StatusEventTimelineMaintenance,
  StatusEventTimelineReportUpdate,
} from "@/components/status-page/status-events";
import { StatusFeed } from "@/components/status-page/status-feed";
import { StatusMonitor } from "@/components/status-page/status-monitor";
import { StatusTrackerGroup } from "@/components/status-page/status-tracker-group";
import { Separator } from "@/components/ui/separator";
import { usePathnamePrefix } from "@/hooks/use-pathname-prefix";
import { useTRPC } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { useMemo } from "react";

export default function Page() {
  const prefix = usePathnamePrefix();
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
      pageComponentIds:
        pageInitial?.pageComponents?.map((c) => c.id.toString()) || [],
      cardType,
      barType,
    }),
    enabled: !!pageInitial && pageInitial.pageComponents.length > 0,
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
                  const lastUpdate = report.statusReportUpdates.sort(
                    (a, b) => b.date.getTime() - a.date.getTime(),
                  )[0];
                  if (!lastUpdate) return null;
                  return (
                    <StatusBannerTabsContent
                      value={`${e.type}-${e.id}`}
                      key={`${e.type}-${e.id}`}
                    >
                      <Link
                        href={`${prefix ? `/${prefix}` : ""}/events/report/${report.id}`}
                        className="rounded-lg"
                      >
                        <StatusBannerContainer status={e.status}>
                          <StatusBannerContent>
                            <StatusEventTimelineReportUpdate
                              report={lastUpdate}
                              withDot={false}
                              isLast={true}
                              withSeparator={false}
                            />
                            {report.statusReportsToPageComponents.length > 0 ? (
                              <StatusEventAffected>
                                {report.statusReportsToPageComponents.map(
                                  (affected) => (
                                    <StatusEventAffectedBadge
                                      key={affected.pageComponent.id}
                                    >
                                      {affected.pageComponent.name}
                                    </StatusEventAffectedBadge>
                                  ),
                                )}
                              </StatusEventAffected>
                            ) : null}
                          </StatusBannerContent>
                        </StatusBannerContainer>
                      </Link>
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
                      <Link
                        href={`${prefix ? `/${prefix}` : ""}/events/maintenance/${maintenance.id}`}
                        className="rounded-lg"
                      >
                        <StatusBannerContainer status={e.status}>
                          <StatusBannerContent>
                            <StatusEventTimelineMaintenance
                              maintenance={maintenance}
                              withDot={false}
                            />
                            {maintenance.maintenancesToPageComponents.length >
                            0 ? (
                              <StatusEventAffected>
                                {maintenance.maintenancesToPageComponents.map(
                                  (affected) => (
                                    <StatusEventAffectedBadge
                                      key={affected.pageComponent.id}
                                    >
                                      {affected.pageComponent.name}
                                    </StatusEventAffectedBadge>
                                  ),
                                )}
                              </StatusEventAffected>
                            ) : null}
                          </StatusBannerContent>
                        </StatusBannerContainer>
                      </Link>
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
              if (tracker.type === "component") {
                const component = tracker.component;

                // Fetch uptime data by component ID
                const { data, uptime } =
                  uptimeData?.find((u) => u.pageComponentId === component.id) ??
                  {};

                return (
                  <StatusMonitor
                    key={`component-${component.id}`}
                    status={component.status}
                    data={data}
                    monitor={{
                      name: component.name,
                      description: component.description,
                    }}
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
                  {tracker.components.map((component) => {
                    const { data, uptime } =
                      uptimeData?.find(
                        (u) => u.pageComponentId === component.id,
                      ) ?? {};

                    return (
                      <StatusMonitor
                        key={`component-${component.id}`}
                        status={component.status}
                        data={data}
                        monitor={{
                          name: component.name,
                          description: component.description,
                        }}
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
                affected: report.statusReportsToPageComponents.map(
                  (component) => component.pageComponent.name,
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
                affected: maintenance.maintenancesToPageComponents.map(
                  (component) => component.pageComponent.name,
                ),
              }))}
          />
        </StatusContent>
      </Status>
    </div>
  );
}
