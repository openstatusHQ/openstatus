import { heartbeatExpectation } from "@openstatus/utils";
import { useQuery } from "@tanstack/react-query";

import {
  EntityCard,
  EntityCardContent,
  EntityCardRow,
} from "@/components/common/entity-card";
import { entityKinds, findById } from "@/data/entity-refs.client";
import { getMonitorHealth, monitorHealthConfig } from "@/data/monitors.client";
import { useTRPC } from "@/lib/trpc/client";

import { EntityRefFallback, EntityRefHeader } from "../parts";

export function MonitorCard({ id }: { id: number }) {
  const trpc = useTRPC();
  const monitor = useQuery({
    ...trpc.monitor.list.queryOptions(),
    select: findById(id),
  });

  if (!monitor.data) {
    return <EntityRefFallback kind="monitor" id={id} query={monitor} />;
  }
  const { data } = monitor;

  return (
    <EntityCard>
      <EntityRefHeader kind="monitor" href={entityKinds.monitor.href(data)}>
        {data.name}
      </EntityRefHeader>
      <EntityCardContent>
        <EntityCardRow label="Status">
          {monitorHealthConfig[getMonitorHealth(data)].label}
        </EntityCardRow>
        {data.jobType === "heartbeat" ? (
          <EntityCardRow label="HEARTBEAT">
            {heartbeatExpectation(data)}
          </EntityCardRow>
        ) : (
          <>
            <EntityCardRow label={data.jobType.toUpperCase()} title={data.url}>
              {data.url}
            </EntityCardRow>
            <EntityCardRow label="Frequency">{data.periodicity}</EntityCardRow>
            <EntityCardRow label="Regions">{data.regions.length}</EntityCardRow>
          </>
        )}
      </EntityCardContent>
    </EntityCard>
  );
}
