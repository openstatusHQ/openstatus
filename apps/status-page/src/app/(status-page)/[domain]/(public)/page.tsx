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
import { Separator } from "@/components/ui/separator";
import { useTRPC } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
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
      // NOTE: we could move that to the server as we query the page entry anyways
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
        {page.openEvents.length > 0 ? (
          <StatusContent>
            <StatusBannerTabs
              defaultValue={`${page.openEvents[0].type}-${page.openEvents[0].id}`}
            >
              <StatusBannerTabsList>
                {page.openEvents.map((e, i) => {
                  return (
                    <StatusBannerTabsTrigger
                      value={`${e.type}-${e.id}`}
                      status={e.status}
                      key={e.id}
                      className={cn(
                        i === 0 && "rounded-tl-lg",
                        i === page.openEvents.length - 1 && "rounded-tr-lg",
                      )}
                    >
                      {e.name}
                    </StatusBannerTabsTrigger>
                  );
                })}
              </StatusBannerTabsList>
              {page.openEvents.map((e) => {
                if (e.type === "report") {
                  const report = page.statusReports.find(
                    (report) => report.id === e.id,
                  );
                  if (!report) return null;
                  return (
                    <StatusBannerTabsContent
                      value={`${e.type}-${e.id}`}
                      key={e.id}
                    >
                      <StatusBannerContainer status={e.status}>
                        <StatusBannerContent>
                          <StatusEventTimelineReport
                            updates={report.statusReportUpdates}
                            withDot={false}
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
                return null;
              })}
            </StatusBannerTabs>
          </StatusContent>
        ) : (
          <StatusBanner status={page.status} />
        )}
        {/* NOTE: check what gap feels right */}
        <StatusContent className="gap-5">
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
              .filter((report) =>
                page.lastEvents.some((event) => event.id === report.id),
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
                page.lastEvents.some((event) => event.id === maintenance.id),
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
