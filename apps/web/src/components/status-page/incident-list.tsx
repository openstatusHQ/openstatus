import type { z } from "zod";

import type {
  selectIncidentsPageSchema,
  selectPublicMonitorSchema,
} from "@openstatus/db/src/schema";

import { notEmpty } from "@/lib/utils";
import { AffectedMonitors } from "../incidents/affected-monitors";
import { Events } from "../incidents/events";
import { StatusBadge } from "../incidents/status-badge";

// TODO: change layout - it is too packed with data rn

export const IncidentList = ({
  incidents,
  monitors,
}: {
  incidents: z.infer<typeof selectIncidentsPageSchema>;
  monitors: z.infer<typeof selectPublicMonitorSchema>[];
}) => {
  // TBD
  // const currentIncidents = incidents.filter(
  //   ({ status }) => status !== "resolved",
  // );

  return (
    <>
      {incidents?.length > 0 ? (
        <div className="grid gap-4">
          <h2 className="text-muted-foreground text-lg font-light">
            All Incidents
          </h2>
          {incidents.map((incident) => {
            return (
              <div key={incident.id} className="grid gap-4 text-left">
                <div className="max-w-3xl font-semibold">
                  {incident.title}
                  <StatusBadge status={incident.status} />
                </div>
                <div>
                  <p className="text-muted-foreground mb-1 text-xs">
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
                <div>
                  <p className="text-muted-foreground mb-1 text-xs">
                    Latest Updates
                  </p>
                  <Events incidentUpdates={incident.incidentUpdates} />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <h2 className="text-muted-foreground text-lg font-light">
          No Incidents
        </h2>
      )}
    </>
  );
};
