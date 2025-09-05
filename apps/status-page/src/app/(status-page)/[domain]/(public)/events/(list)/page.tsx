"use client";

import {
  StatusEvent,
  StatusEventAffected,
  StatusEventAside,
  StatusEventContent,
  StatusEventTimelineMaintenance,
  StatusEventTimelineReport,
  StatusEventTitle,
} from "@/components/status-page/status-events";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";

import {
  EmptyStateContainer,
  EmptyStateDescription,
  EmptyStateTitle,
} from "@/components/content/empty-state";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate } from "@/lib/formatter";
import Link from "next/link";

// TODO: include ?filter=maintenance/reports

export default function Page() {
  const { domain } = useParams<{ domain: string }>();
  const trpc = useTRPC();
  const { data: page } = useQuery(
    trpc.statusPage.get.queryOptions({ slug: domain }),
  );

  if (!page) return null;

  const { statusReports, maintenances } = page;

  return (
    <Tabs defaultValue="reports" className="gap-4">
      <TabsList>
        <TabsTrigger value="reports">Reports</TabsTrigger>
        <TabsTrigger value="maintenances">Maintenances</TabsTrigger>
      </TabsList>
      <TabsContent value="reports" className="flex flex-col gap-4">
        {statusReports.length > 0 ? (
          statusReports.map((report) => {
            const startedAt = report.statusReportUpdates[0].date;
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
                    <StatusEventTitle>{report.title}</StatusEventTitle>
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
          <EmptyStateContainer>
            <EmptyStateTitle>No reports found</EmptyStateTitle>
            <EmptyStateDescription>
              No reports found for this status page.
            </EmptyStateDescription>
          </EmptyStateContainer>
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
          <EmptyStateContainer>
            <EmptyStateTitle>No maintenances found</EmptyStateTitle>
            <EmptyStateDescription>
              No maintenances found for this status page.
            </EmptyStateDescription>
          </EmptyStateContainer>
        )}
      </TabsContent>
    </Tabs>
  );
}
