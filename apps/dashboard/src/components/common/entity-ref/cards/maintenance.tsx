import { useQuery } from "@tanstack/react-query";

import {
  EntityCard,
  EntityCardContent,
  EntityCardRow,
} from "@/components/common/entity-card";
import { entityKinds } from "@/data/entity-refs.client";
import {
  getMaintenanceStatus,
  maintenanceStatusConfig,
} from "@/data/overview-events.client";
import { formatDateRange } from "@/lib/formatter";
import { useTRPC } from "@/lib/trpc/client";

import { EntityRefFallback, EntityRefHeader, lookupOptions } from "../parts";

export function MaintenanceCard({ id }: { id: number }) {
  const trpc = useTRPC();
  const maintenance = useQuery(
    trpc.maintenance.get.queryOptions({ id }, lookupOptions),
  );

  if (!maintenance.data) {
    return <EntityRefFallback kind="maintenance" id={id} query={maintenance} />;
  }
  const { data } = maintenance;
  const components = data.pageComponents.map((c) => c.name).join(", ");

  return (
    <EntityCard>
      <EntityRefHeader
        kind="maintenance"
        href={
          data.pageId === null
            ? undefined
            : entityKinds.maintenance.href({ id, pageId: data.pageId })
        }
      >
        {data.title}
      </EntityRefHeader>
      <EntityCardContent>
        <EntityCardRow label="Status">
          {maintenanceStatusConfig[getMaintenanceStatus(data)].label}
        </EntityCardRow>
        <EntityCardRow label="Window" className="whitespace-normal">
          <time dateTime={data.from.toISOString()}>
            {formatDateRange(data.from, data.to)}
          </time>
        </EntityCardRow>
        {components ? (
          <EntityCardRow label="Components" title={components}>
            {components}
          </EntityCardRow>
        ) : null}
      </EntityCardContent>
    </EntityCard>
  );
}
