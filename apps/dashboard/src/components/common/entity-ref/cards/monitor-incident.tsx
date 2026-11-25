import { useQuery } from "@tanstack/react-query";

import {
  EntityCard,
  EntityCardContent,
  EntityCardRow,
} from "@/components/common/entity-card";
import { entityKinds } from "@/data/entity-refs.client";
import { resolutionLabel } from "@/data/monitor-report.client";
import {
  getIncidentStatus,
  incidentStatusConfig,
} from "@/data/overview-events.client";
import { formatDurationShort } from "@/lib/formatter";
import { useTRPC } from "@/lib/trpc/client";

import {
  EntityRefFallback,
  EntityRefHeader,
  RelativeTime,
  lookupOptions,
} from "../parts";

export function MonitorIncidentCard({ id }: { id: number }) {
  const trpc = useTRPC();
  const incident = useQuery(
    trpc.monitorIncident.get.queryOptions({ id }, lookupOptions),
  );

  if (!incident.data) {
    return (
      <EntityRefFallback kind="monitorIncident" id={id} query={incident} />
    );
  }
  const { data } = incident;
  const { monitorId, startedAt, resolvedAt } = data;

  return (
    <EntityCard>
      <EntityRefHeader
        kind="monitorIncident"
        href={
          data.monitor && monitorId !== null
            ? entityKinds.monitorIncident.href({ monitorId })
            : undefined
        }
      >
        {data.monitor?.name ?? "Deleted monitor"}
      </EntityRefHeader>
      <EntityCardContent>
        <EntityCardRow label="Status">
          {incidentStatusConfig[getIncidentStatus(data)].label}
        </EntityCardRow>
        <EntityCardRow label="Started">
          <RelativeTime date={startedAt} />
        </EntityCardRow>
        {resolvedAt ? (
          <>
            <EntityCardRow label="Duration">
              {formatDurationShort(resolvedAt.getTime() - startedAt.getTime())}
            </EntityCardRow>
            <EntityCardRow label="Resolution" title={resolutionLabel(data)}>
              {resolutionLabel(data)}
            </EntityCardRow>
          </>
        ) : null}
        {data.excusedAt ? (
          <EntityCardRow
            label="Excused"
            title={data.excusedReason ?? undefined}
          >
            {data.excusedReason ?? "Yes"}
          </EntityCardRow>
        ) : null}
      </EntityCardContent>
    </EntityCard>
  );
}
