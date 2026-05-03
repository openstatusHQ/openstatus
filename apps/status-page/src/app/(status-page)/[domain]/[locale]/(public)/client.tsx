"use client";

import { Link } from "@/components/common/link";
import { useStatusPage } from "@/components/status-page/floating-button";
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
  StatusBar,
  StatusBarSkeleton,
} from "@/components/status-page/status-bar";
import { StatusComponentGroup } from "@/components/status-page/status-component-group";
import {
  StatusEventAffected,
  StatusEventAffectedBadge,
  StatusEventTimelineMaintenance,
  StatusEventTimelineReportUpdate,
} from "@/components/status-page/status-events";
import { StatusFeed } from "@/components/status-page/status-feed";
import { useEmbed } from "@/hooks/use-embed";
import { usePathnamePrefix } from "@/hooks/use-pathname-prefix";
import { useTRPC } from "@/lib/trpc/client";
import {
  StatusComponent,
  StatusComponentBody,
  StatusComponentDescription,
  StatusComponentFooter,
  StatusComponentHeader,
  StatusComponentHeaderLeft,
  StatusComponentHeaderRight,
  StatusComponentIcon,
  StatusComponentStatus,
  StatusComponentTitle,
  StatusComponentUptime,
  StatusComponentUptimeSkeleton,
} from "@openstatus/ui/components/blocks/status-component";
import {
  Status,
  StatusContent,
  StatusDescription,
  StatusHeader,
  StatusTitle,
} from "@openstatus/ui/components/blocks/status-layout";
import { Separator } from "@openstatus/ui/components/ui/separator";
import { cn } from "@openstatus/ui/lib/utils";
import { skipToken, useQuery } from "@tanstack/react-query";
import { notFound, useParams } from "next/navigation";
import { useMemo } from "react";

export function Client() {
  const prefix = usePathnamePrefix();
  const { domain } = useParams<{ domain: string }>();
  const { cardType, barType, showUptime } = useStatusPage();
  const embed = useEmbed();
  const trpc = useTRPC();

  // NOTE: we cannot use `cardType` and `barType` here because of queryKey changes
  // It wouldn't match the server prefetch keys and we would have to refetch the page here
  const {
    data: pageInitial,
    error,
    isLoading: isPageLoading,
  } = useQuery({
    ...trpc.statusPage.get.queryOptions({
      slug: domain,
    }),
    enabled: !!domain,
  });

  // Handle case where page doesn't exist or query fails
  if (!isPageLoading && (error || !pageInitial)) {
    notFound();
  }

  const componentsVisible =
    !embed.mode || embed.sections.includes("components");

  const hasCustomConfig = pageInitial?.configuration
    ? pageInitial.configuration.type !== barType ||
      pageInitial.configuration.value !== cardType
    : false;

  // NOTE: instead, we use the `enabled` flag to only fetch the page if the configuration differs.
  // Also skip when `components` section is hidden in embed mode — this query only matters there.
  const { data: pageWithCustomConfiguration } = useQuery({
    ...trpc.statusPage.get.queryOptions({
      slug: domain,
      cardType,
      barType,
    }),
    enabled: !!domain && hasCustomConfig && componentsVisible,
  });

  // NOTE: we can prefetch that to avoid loading state
  // NOTE: using skipToken instead of enabled:false to prevent tRPC from including this in a batch request with undefined input
  const { data: uptimeData, isLoading } = useQuery(
    trpc.statusPage.getUptime.queryOptions(
      componentsVisible && pageInitial && pageInitial.pageComponents.length > 0
        ? {
            slug: domain,
            pageComponentIds: pageInitial.pageComponents.map((c) =>
              c.id.toString(),
            ),
            cardType,
            barType,
          }
        : skipToken,
    ),
  );

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

  return (
    <div className="flex flex-col gap-6">
      <Status variant={page.status}>
        <StatusHeader className="group-data-[hide-title=true]/embed:hidden">
          <StatusTitle>{page.title}</StatusTitle>
          <StatusDescription>{page.description}</StatusDescription>
        </StatusHeader>
        {events.length > 0 ? (
          <StatusContent className="group-data-[hide-banner=true]/embed:hidden">
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
                        variant="unstyled"
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
                        variant="unstyled"
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
          <StatusBanner
            status={page.status}
            className="group-data-[hide-banner=true]/embed:hidden"
          />
        )}
        {/* NOTE: check what gap feels right */}
        {page.trackers.length > 0 ? (
          <StatusContent className="gap-5 group-data-[hide-components=true]/embed:hidden">
            {page.trackers.map((tracker) => {
              if (tracker.type === "component") {
                const component = tracker.component;
                const { data, uptime } =
                  uptimeData?.find((u) => u.pageComponentId === component.id) ??
                  {};

                return (
                  <ComponentCard
                    key={`component-${component.id}`}
                    name={component.name}
                    description={component.description}
                    status={component.status}
                    data={data}
                    uptime={uptime}
                    showUptime={showUptime}
                    isLoading={isLoading}
                  />
                );
              }

              return (
                <StatusComponentGroup
                  key={`group-${tracker.groupId}`}
                  title={tracker.groupName}
                  status={tracker.status}
                  defaultOpen={tracker.defaultOpen}
                >
                  {tracker.components.map((component) => {
                    const { data, uptime } =
                      uptimeData?.find(
                        (u) => u.pageComponentId === component.id,
                      ) ?? {};

                    return (
                      <ComponentCard
                        key={`component-${component.id}`}
                        name={component.name}
                        description={component.description}
                        status={component.status}
                        data={data}
                        uptime={uptime}
                        showUptime={showUptime}
                        isLoading={isLoading}
                      />
                    );
                  })}
                </StatusComponentGroup>
              );
            })}
          </StatusContent>
        ) : null}
        <Separator className="group-data-[hide-components=true]/embed:hidden group-data-[hide-feed=true]/embed:hidden" />
        <StatusContent className="group-data-[hide-feed=true]/embed:hidden">
          <StatusFeed
            statusReports={page.statusReports
              .filter(
                (report) =>
                  report.statusReportUpdates.length > 0 &&
                  page.lastEvents.some(
                    (event) =>
                      event.id === report.id && event.type === "report",
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

type ComponentCardData = NonNullable<Parameters<typeof StatusBar>[0]["data"]>;

function ComponentCard({
  name,
  description,
  status,
  data,
  uptime,
  showUptime,
  isLoading,
}: {
  name: string;
  description?: string | null;
  status: "success" | "degraded" | "error" | "info";
  data?: ComponentCardData;
  uptime?: string;
  showUptime?: boolean;
  isLoading?: boolean;
}) {
  return (
    <StatusComponent variant={status}>
      <StatusComponentHeader>
        <StatusComponentHeaderLeft>
          <StatusComponentTitle>{name}</StatusComponentTitle>
          <StatusComponentDescription>{description}</StatusComponentDescription>
        </StatusComponentHeaderLeft>
        <StatusComponentHeaderRight>
          {showUptime ? (
            <>
              {isLoading ? (
                <StatusComponentUptimeSkeleton />
              ) : (
                <StatusComponentUptime>{uptime}</StatusComponentUptime>
              )}
              <StatusComponentIcon />
            </>
          ) : (
            <StatusComponentStatus />
          )}
        </StatusComponentHeaderRight>
      </StatusComponentHeader>
      <StatusComponentBody>
        {isLoading ? <StatusBarSkeleton /> : <StatusBar data={data ?? []} />}
        <StatusComponentFooter data={data ?? []} isLoading={isLoading} />
      </StatusComponentBody>
    </StatusComponent>
  );
}
