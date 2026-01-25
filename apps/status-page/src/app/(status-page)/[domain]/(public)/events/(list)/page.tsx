"use client";

import { StatusBlankEvents } from "@/components/status-page/status-blank";
import {
  StatusEvent,
  StatusEventAffected,
  StatusEventAffectedBadge,
  StatusEventAside,
  StatusEventContent,
  StatusEventDate,
  StatusEventGroup,
  StatusEventTimelineMaintenance,
  StatusEventTimelineReport,
  StatusEventTitle,
  StatusEventTitleCheck,
} from "@/components/status-page/status-events";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
      <TabsContent value="reports">
        <StatusEventGroup>
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
                report.status === "resolved" &&
                lastUpdate.status !== "resolved";
              return (
                <StatusEvent key={report.id}>
                  <StatusEventAside>
                    <StatusEventDate date={startedAt} />
                  </StatusEventAside>
                  <Link
                    href={`./events/report/${report.id}`}
                    className="rounded-lg"
                  >
                    <StatusEventContent>
                      <StatusEventTitle className="inline-flex gap-1">
                        {report.title}
                        {isReportResolvedOnly ? (
                          <StatusEventTitleCheck />
                        ) : null}
                      </StatusEventTitle>
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
                      <StatusEventTimelineReport
                        updates={report.statusReportUpdates}
                        reportId={report.id}
                      />
                    </StatusEventContent>
                  </Link>
                </StatusEvent>
              );
            })
          ) : (
            <StatusBlankEvents />
          )}
        </StatusEventGroup>
      </TabsContent>
      <TabsContent value="maintenances">
        <StatusEventGroup>
          {maintenances.length > 0 ? (
            maintenances.map((maintenance) => {
              return (
                <StatusEvent key={maintenance.id}>
                  <StatusEventAside>
                    <StatusEventDate date={maintenance.from} />
                  </StatusEventAside>
                  <Link
                    href={`./events/maintenance/${maintenance.id}`}
                    className="rounded-lg"
                  >
                    <StatusEventContent>
                      <StatusEventTitle>{maintenance.title}</StatusEventTitle>
                      {maintenance.maintenancesToPageComponents.length > 0 ? (
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
                      <StatusEventTimelineMaintenance
                        maintenance={maintenance}
                      />
                    </StatusEventContent>
                  </Link>
                </StatusEvent>
              );
            })
          ) : (
            <StatusBlankEvents
              title="No maintenances found"
              description="No maintenances found for this status page."
            />
          )}
        </StatusEventGroup>
      </TabsContent>
    </Tabs>
  );
}
