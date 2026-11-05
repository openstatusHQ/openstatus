import { useQuery } from "@tanstack/react-query";

import {
  EntityCard,
  EntityCardContent,
  EntityCardRow,
} from "@/components/common/entity-card";
import { entityKinds } from "@/data/entity-refs.client";
import { severityConfig, statusConfig } from "@/data/managed-incidents.client";
import { useTRPC } from "@/lib/trpc/client";

import {
  EntityRefFallback,
  EntityRefHeader,
  RelativeTime,
  lookupOptions,
} from "../parts";

export function IncidentCard({ id }: { id: number }) {
  const trpc = useTRPC();
  const incident = useQuery(
    trpc.incident.get.queryOptions({ id }, lookupOptions),
  );

  if (!incident.data) {
    return <EntityRefFallback kind="incident" id={id} query={incident} />;
  }
  const { data } = incident;

  return (
    <EntityCard>
      <EntityRefHeader kind="incident" href={entityKinds.incident.href(data)}>
        {data.title}
      </EntityRefHeader>
      <EntityCardContent>
        <EntityCardRow label="Status">
          {statusConfig[data.status].label}
        </EntityCardRow>
        <EntityCardRow label="Severity">
          {severityConfig[data.severity].label}
        </EntityCardRow>
        <EntityCardRow label="Started">
          <RelativeTime date={data.startedAt} />
        </EntityCardRow>
        <EntityCardRow label="Commander">
          {data.commander
            ? (data.commander.name ?? data.commander.email)
            : "Unassigned"}
        </EntityCardRow>
        {data.statusReport ? (
          <EntityCardRow label="Report">
            {data.statusReport.title}
          </EntityCardRow>
        ) : null}
      </EntityCardContent>
    </EntityCard>
  );
}
