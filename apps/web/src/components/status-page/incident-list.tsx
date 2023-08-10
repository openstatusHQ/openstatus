import { format } from "date-fns";
import type { z } from "zod";

import type { selectIncidentsPageSchema } from "@openstatus/db/src/schema";

import { statusDict } from "@/data/incidents-dictionary";
import { Icons } from "../icons";
import { Badge } from "../ui/badge";

// Check event.tsx for design inspiration

export const IncidentList = ({
  incidents,
}: {
  incidents: z.infer<typeof selectIncidentsPageSchema>;
}) => {
  return (
    <>
      <h2 className="mb-8 text-lg">Incidents</h2>
      <div className="grid gap-4">
        {incidents.map((incident) => {
          return (
            <div key={incident.id}>
              <div className="text-foreground  flex items-center font-medium">
                <p className="max-w-3xl text-sm">{incident.title}</p>
              </div>
              {incident.incidentUpdates.map((incidentUpdate) => {
                const { icon, label } = statusDict[incidentUpdate.status];
                const StatusIcon = Icons[icon];

                return (
                  <>
                    <div className="text-muted-foreground flex items-center text-xs font-light">
                      {format(
                        new Date(incidentUpdate.date || 0),
                        "LLL dd, y HH:mm",
                      )}
                      <span className="text-muted-foreground/70 mx-1">
                        &bull;
                      </span>

                      <Badge variant="secondary">
                        <StatusIcon className="mr-1 h-3 w-3" />
                        {label}
                      </Badge>
                    </div>
                    <div className="text-foreground  flex items-center font-medium">
                      <span className="text-sm">{incidentUpdate.message}</span>
                    </div>
                  </>
                );
              })}
            </div>
          );
        })}
      </div>
    </>
  );
};
