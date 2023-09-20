import type { z } from "zod";

import type {
  selectIncidentsPageSchema,
  selectPublicMonitorSchema,
} from "@openstatus/db/src/schema";

import { notEmpty } from "@/lib/utils";
import { AffectedMonitors } from "../incidents/affected-monitors";
import { Events } from "../incidents/events";
import { StatusBadge } from "../incidents/status-badge";
import { getI18n } from '@/yuzu/server';

// TODO: change layout - it is too packed with data rn

export const IncidentList = async ({
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

  const t = await getI18n()

  return (
    <>
      {_incidents.sort((a, b) => {
        if (a.updatedAt == undefined) return 1;
        if (b.updatedAt == undefined) return -1;
        return b.updatedAt.getTime() - a.updatedAt.getTime();
      })?.length > 0 ? (
        <div className="grid gap-4">
          <h2 className="text-muted-foreground text-lg font-light">
            {context === "all" ? t("All incidents") : t("Latest incidents")}
          </h2>
          {_incidents.map((incident) => {
            return (
              <div key={incident.id} className="grid gap-4 text-left">
                <div className="max-w-3xl font-semibold">
                  {incident.title}
                  <StatusBadge status={incident.status} />
                </div>
                <div className="overflow-hidden text-ellipsis">
                  <p className="text-muted-foreground mb-2 text-xs">
                    {t('Affected Monitors')}
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
                  <p className="text-muted-foreground mb-2 text-xs">
                    {t('Latest Updates')}
                  </p>
                  <Events incidentUpdates={incident.incidentUpdates} />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-muted-foreground text-center text-sm font-light">
          {context === "all"
            ? t("No incidents.")
            : t("No incidents in the last week.")}
        </p>
      )}
    </>
  );
};
