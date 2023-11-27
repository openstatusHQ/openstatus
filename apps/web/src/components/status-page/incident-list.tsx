import type { z } from "zod";

import type {
  selectIncidentsPageSchema,
  selectPublicMonitorSchema,
} from "@openstatus/db/src/schema";

import { notEmpty } from "@/lib/utils";
import { AffectedMonitors } from "../status-update/affected-monitors";
import { Events } from "../status-update/events";
import { StatusBadge } from "../status-update/status-badge";

// TODO: change layout - it is too packed with data rn

export const IncidentList = ({
  incidents,
  monitors,
  context = "all",
}: {
  incidents: z.infer<typeof selectIncidentsPageSchema>;
  monitors: z.infer<typeof selectPublicMonitorSchema>[];
  context?: "all" | "latest"; // latest 7 days
}) => {
  const lastWeek = Date.now() - 1000 * 60 * 60 * 24 * 7;

  function getLastWeeksIncidents() {
    return incidents.filter((incident) => {
      return incident.incidentUpdates.some(
        (update) => update.date.getTime() > lastWeek,
      );
    });
  }

  const _incidents = context === "all" ? incidents : getLastWeeksIncidents();

  return (
    <>
      {_incidents.sort((a, b) => {
        if (a.updatedAt == undefined) return 1;
        if (b.updatedAt == undefined) return -1;
        return b.updatedAt.getTime() - a.updatedAt.getTime();
      })?.length > 0 ? (
        <div className="grid gap-4">
          <h2 className="text-muted-foreground text-lg font-light">
            {context === "all" ? "All incidents" : "Latest incidents"}
          </h2>
          {_incidents.map((incident) => {
            const affectedMonitors = incident.monitorsToIncidents
              .map(({ monitorId }) => {
                const monitor = monitors.find(({ id }) => monitorId === id);
                return monitor || undefined;
              })
              .filter(notEmpty);
            return (
              <div key={incident.id} className="grid gap-4 text-left">
                <div className="max-w-3xl font-semibold">
                  {incident.title}
                  <StatusBadge status={incident.status} className="ml-2" />
                </div>
                {Boolean(affectedMonitors.length) ? (
                  <div className="overflow-hidden text-ellipsis">
                    <p className="text-muted-foreground mb-2 text-xs">
                      Affected Monitors
                    </p>
                    <AffectedMonitors
                      monitors={incident.monitorsToIncidents
                        .map(({ monitorId }) => {
                          const monitor = monitors.find(
                            ({ id }) => monitorId === id,
                          );
                          return monitor || undefined;
                        })
                        .filter(notEmpty)}
                    />
                  </div>
                ) : null}
                <div>
                  <p className="text-muted-foreground mb-2 text-xs">
                    Latest Updates
                  </p>
                  <Events statusReportUpdates={incident.incidentUpdates} />
                </div>
              </div>
            );
          })}
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
