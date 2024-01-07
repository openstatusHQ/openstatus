"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronRight } from "lucide-react";
import type { z } from "zod";

import type {
  selectPublicMonitorSchema,
  selectStatusReportPageSchema,
} from "@openstatus/db/src/schema";
import { Button, Separator } from "@openstatus/ui";

import { setPrefixUrl } from "@/app/status-page/[domain]/utils";
import { notEmpty } from "@/lib/utils";
import { Events } from "../status-update/events";
import { Summary } from "../status-update/summary";

// TODO: change layout - it is too packed with data rn

export const IncidentList = ({
  incidents,
  monitors,
  context = "all",
}: {
  incidents: z.infer<typeof selectStatusReportPageSchema>;
  monitors: z.infer<typeof selectPublicMonitorSchema>[];
  context?: "all" | "latest"; // latest 7 days
}) => {
  const params = useParams<{ domain: string }>();
  const lastWeek = Date.now() - 1000 * 60 * 60 * 24 * 7;

  function getLastWeeksIncidents() {
    return incidents.filter((incident) => {
      return incident.statusReportUpdates.some(
        (update) => update.date.getTime() > lastWeek,
      );
    });
  }

  const _incidents = context === "all" ? incidents : getLastWeeksIncidents();

  _incidents.sort((a, b) => {
    // biome-ignore lint/suspicious/noDoubleEquals:
    if (a.updatedAt == undefined) return 1;
    // biome-ignore lint/suspicious/noDoubleEquals:
    if (b.updatedAt == undefined) return -1;
    return b.updatedAt.getTime() - a.updatedAt.getTime();
  });

  return (
    <>
      {_incidents?.length > 0 ? (
        <div className="grid gap-3">
          <p className="text-muted-foreground text-sm font-light">
            {context === "all" ? "All incidents" : "Latest incidents"}
          </p>
          <div className="grid gap-8">
            {_incidents.map((incident) => {
              const affectedMonitors = incident.monitorsToStatusReports
                .map(({ monitorId }) => {
                  const monitor = monitors.find(({ id }) => monitorId === id);
                  return monitor || undefined;
                })
                .filter(notEmpty);
              return (
                <div key={incident.id} className="group grid gap-4 text-left">
                  <div className="flex items-center gap-1">
                    <h3 className="text-xl font-semibold">{incident.title}</h3>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="invisible h-7 w-7 group-hover:visible"
                      asChild
                    >
                      <Link
                        href={setPrefixUrl(`/incidents/${incident.id}`, params)}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                  <Summary report={incident} monitors={affectedMonitors} />
                  <Separator />
                  <Events
                    statusReportUpdates={incident.statusReportUpdates}
                    collabsible
                  />
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="text-muted-foreground text-center text-sm font-light">
          {context === "all"
            ? "No incidents."
            : "No incidents in the last week."}
        </p>
      )}
    </>
  );
};
