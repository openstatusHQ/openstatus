import { useQuery } from "@tanstack/react-query";

import {
  EntityCard,
  EntityCardContent,
  EntityCardRow,
} from "@/components/common/entity-card";
import { entityKinds } from "@/data/entity-refs.client";
import {
  excusedKindLabels,
  formatExcusedWindow,
} from "@/data/reportings.client";
import { useTRPC } from "@/lib/trpc/client";

import { EntityRefFallback, EntityRefHeader, lookupOptions } from "../parts";

export function MonitorReportingExcusedWindowCard({ id }: { id: number }) {
  const trpc = useTRPC();
  const window = useQuery(
    trpc.monitorReporting.excusedWindow.queryOptions({ id }, lookupOptions),
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
            {formatExcusedWindow(data.from, data.to, data.policy.timeZone)}
          </time>{" "}
          <span className="text-muted-foreground">{data.policy.timeZone}</span>
        </EntityCardRow>
        <EntityCardRow label="Reporting" title={data.policy.name}>
          {data.policy.name}
        </EntityCardRow>
      </EntityCardContent>
    </EntityCard>
  );
}
