import { useQuery } from "@tanstack/react-query";

import {
  EntityCard,
  EntityCardContent,
  EntityCardRow,
} from "@/components/common/entity-card";
import { entityKinds } from "@/data/entity-refs.client";
import { formatSlaTarget } from "@/data/sla-policies.client";
import { useTRPC } from "@/lib/trpc/client";

import {
  EntityRefFallback,
  EntityRefHeader,
  lookupOptions,
  RelativeTime,
} from "../parts";

export function MonitorSlaPolicyCard({ id }: { id: number }) {
  const trpc = useTRPC();
  const policy = useQuery(
    trpc.monitorSlaPolicy.summary.queryOptions({ id }, lookupOptions),
  );

  if (!policy.data) {
    return <EntityRefFallback kind="monitorSlaPolicy" id={id} query={policy} />;
  }
  const { data } = policy;

  return (
    <EntityCard>
      <EntityRefHeader
        kind="monitorSlaPolicy"
        href={entityKinds.monitorSlaPolicy.href(data)}
      >
        {data.name}
      </EntityRefHeader>
      <EntityCardContent>
        <EntityCardRow label="Target">
          {formatSlaTarget(data.target)}%
        </EntityCardRow>
        <EntityCardRow label="Monitors">{data.monitors.length}</EntityCardRow>
        {data.archivedAt ? (
          <EntityCardRow label="Archived">
            <RelativeTime date={data.archivedAt} />
          </EntityCardRow>
        ) : null}
      </EntityCardContent>
    </EntityCard>
  );
}
