import { format } from "date-fns";
import type { z } from "zod";

import type { selectIncidentSchema } from "@openstatus/db/src/schema";

import { statusDict } from "@/data/incidents-dictionary";
import { Icons } from "../icons";
import { Badge } from "../ui/badge";

// Check event.tsx for design inspiration

export const IncidentList = ({
  incidents,
}: {
  incidents: z.infer<typeof selectIncidentSchema>[];
}) => {
  return (
    <div className="grid gap-4">
      {incidents.map((incident) => {
        const { icon, label } = statusDict[incident.status];
        const StatusIcon = Icons[icon];
        return (
          <div key={incident.id}>
            <div className="text-muted-foreground flex items-center text-xs font-light">
              {/* TODO: use incidentUpdate.date */}
              {format(new Date(incident.createdAt || 0), "LLL dd, y HH:mm")}
              <span className="text-muted-foreground/70 mx-1">&bull;</span>
              <Badge variant="secondary">
                <StatusIcon className="mr-1 h-3 w-3" />
                {label}
              </Badge>
            </div>
            <div>
              {/* TODO: use incidentUpdate.message */}
              <p className="max-w-3xl text-sm">Hello World!</p>
            </div>
          </div>
        );
      })}
    </div>
  );
};
