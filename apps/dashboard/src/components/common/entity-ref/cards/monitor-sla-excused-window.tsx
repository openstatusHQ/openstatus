import { useQuery } from "@tanstack/react-query";

import {
  EntityCard,
  EntityCardContent,
  EntityCardRow,
} from "@/components/common/entity-card";
import { entityKinds } from "@/data/entity-refs.client";
import { excusedKindLabels } from "@/data/sla-policies.client";
import { formatDateRange } from "@/lib/formatter";
import { useTRPC } from "@/lib/trpc/client";

import { EntityRefFallback, EntityRefHeader, lookupOptions } from "../parts";

export function MonitorSlaExcusedWindowCard({ id }: { id: number }) {
  const trpc = useTRPC();
  const window = useQuery(
    trpc.monitorSlaPolicy.excusedWindow.queryOptions({ id }, lookupOptions),
  );

  if (!window.data) {
    return (
      <EntityRefFallback
        kind="monitorSlaExcusedWindow"
        id={id}
        query={window}
      />
    );
  }
  const { data } = window;

  return (
    <EntityCard>
      <EntityRefHeader
        kind="monitorSlaExcusedWindow"
        href={entityKinds.monitorSlaExcusedWindow.href(data)}
      >
        {data.reason}
      </EntityRefHeader>
      <EntityCardContent>
        <EntityCardRow label="Kind">
          {excusedKindLabels[data.kind]}
        </EntityCardRow>
        <EntityCardRow label="Window" className="whitespace-normal">
          <time dateTime={data.from.toISOString()}>
            {formatDateRange(data.from, data.to)}
          </time>
        </EntityCardRow>
        <EntityCardRow label="Policy" title={data.policy.name}>
          {data.policy.name}
        </EntityCardRow>
      </EntityCardContent>
    </EntityCard>
  );
}
