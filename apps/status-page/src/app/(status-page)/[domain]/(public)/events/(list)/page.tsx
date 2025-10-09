"use client";

import {
  StatusBlankContainer,
  StatusBlankContent,
  StatusBlankDescription,
  StatusBlankReport,
  StatusBlankTitle,
} from "@/components/status-page/status-blank";
import {
  StatusEvent,
  StatusEventAffected,
  StatusEventAside,
  StatusEventContent,
  StatusEventTimelineMaintenance,
  StatusEventTimelineReport,
  StatusEventTitle,
  StatusEventTitleCheck,
} from "@/components/status-page/status-events";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate } from "@/lib/formatter";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQueryStates } from "nuqs";
import { searchParamsParsers } from "./search-params";

export default function Page() {
  const [{ tab }, setSearchParams] = useQueryStates(searchParamsParsers);
  const { domain } = useParams<{ domain: string }>();
  const trpc = useTRPC();
  const { data: page } = useQuery(
    trpc.statusPage.get.queryOptions({ slug: domain }),
  );

  if (!page) return null;

  const { statusReports, maintenances } = page;

  return (
    <Tabs
      defaultValue={tab}
      onValueChange={(value) =>
        setSearchParams({ tab: value as "reports" | "maintenances" })
      }
      className="gap-4"
    >
      <TabsList>
        <TabsTrigger value="reports">Reports</TabsTrigger>
        <TabsTrigger value="maintenances">Maintenances</TabsTrigger>
      </TabsList>
      <TabsContent value="reports" className="flex flex-col gap-4">
        {statusReports.length > 0 ? (
          statusReports.map((report) => {
            const updates = report.statusReportUpdates.sort(
              (a, b) => b.date.getTime() - a.date.getTime(),
            );
            const firstUpdate = updates[updates.length - 1];
            const lastUpdate = updates[0];
            // NOTE: updates are sorted descending by date
            const startedAt = firstUpdate.date;
            // HACKY: LEGACY: only resolved via report and not via report update
            const isReportResolvedOnly =
              report.status === "resolved" && lastUpdate.status !== "resolved";
            return (
              <StatusEvent key={report.id}>
                <StatusEventAside>
                  <span className="font-medium text-foreground/80">
                    {formatDate(startedAt, { month: "short" })}
                  </span>
                </StatusEventAside>
                <Link
                  href={`./events/report/${report.id}`}
                  className="rounded-lg"
                >
                  <StatusEventContent>
                    <StatusEventTitle className="inline-flex gap-1">
                      {report.title}
                      {isReportResolvedOnly ? <StatusEventTitleCheck /> : null}
                    </StatusEventTitle>
                    {report.monitorsToStatusReports.length > 0 ? (
                      <StatusEventAffected className="flex flex-wrap gap-1">
                        {report.monitorsToStatusReports.map((affected) => (
                          <Badge
                            key={affected.monitor.id}
                            variant="outline"
                            className="text-[10px]"
                          >
                            {affected.monitor.name}
                          </Badge>
                        ))}
                      </StatusEventAffected>
                    ) : null}
                    <StatusEventTimelineReport
                      updates={report.statusReportUpdates}
                    />
                  </StatusEventContent>
                </Link>
              </StatusEvent>
            );
          })
        ) : (
          <StatusBlankContainer>
            <div className="relative mt-8 flex w-full flex-col items-center justify-center">
              <StatusBlankReport className="-top-16 absolute scale-60 opacity-50" />
              <StatusBlankReport className="-top-8 absolute scale-80 opacity-80" />
              <StatusBlankReport />
            </div>
            <StatusBlankContent>
              <StatusBlankTitle>No reports found</StatusBlankTitle>
              <StatusBlankDescription>
                No reports found for this status page.
              </StatusBlankDescription>
            </StatusBlankContent>
          </StatusBlankContainer>
        )}
      </TabsContent>
      <TabsContent value="maintenances" className="flex flex-col gap-4">
        {maintenances.length > 0 ? (
          maintenances.map((maintenance) => {
            const isFuture = maintenance.from > new Date();
            return (
              <StatusEvent key={maintenance.id}>
                <StatusEventAside>
                  <span className="font-medium text-foreground/80">
                    {formatDate(maintenance.from, { month: "short" })}
                  </span>
                  {isFuture ? (
                    <span className="text-info text-sm">Upcoming</span>
                  ) : null}
                </StatusEventAside>
                <Link
                  href={`./events/maintenance/${maintenance.id}`}
                  className="rounded-lg"
                >
                  <StatusEventContent>
                    <StatusEventTitle>{maintenance.title}</StatusEventTitle>
                    {maintenance.maintenancesToMonitors.length > 0 ? (
                      <StatusEventAffected className="flex flex-wrap gap-1">
                        {maintenance.maintenancesToMonitors.map((affected) => (
                          <Badge
                            key={affected.monitor.id}
                            variant="outline"
                            className="text-[10px]"
                          >
                            {affected.monitor.name}
                          </Badge>
                        ))}
                      </StatusEventAffected>
                    ) : null}
                    <StatusEventTimelineMaintenance maintenance={maintenance} />
                  </StatusEventContent>
                </Link>
              </StatusEvent>
            );
          })
        ) : (
          <StatusBlankContainer>
            <div className="relative mt-8 flex w-full flex-col items-center justify-center">
              <StatusBlankReport className="-top-16 absolute scale-60 opacity-50" />
              <StatusBlankReport className="-top-8 absolute scale-80 opacity-80" />
              <StatusBlankReport />
            </div>
            <StatusBlankContent>
              <StatusBlankTitle>No maintenances found</StatusBlankTitle>
              <StatusBlankDescription>
                No maintenances found for this status page.
              </StatusBlankDescription>
            </StatusBlankContent>
          </StatusBlankContainer>
        )}
      </TabsContent>
    </Tabs>
  );
}
