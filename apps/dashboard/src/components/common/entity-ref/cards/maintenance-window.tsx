import { useQuery } from "@tanstack/react-query";

import {
  EntityCard,
  EntityCardContent,
  EntityCardRow,
} from "@/components/common/entity-card";
import { entityKinds } from "@/data/entity-refs.client";
import { maintenanceWindowModeLabels } from "@/data/maintenance-windows.client";
import { formatDateRange } from "@/lib/formatter";
import { useTRPC } from "@/lib/trpc/client";

import { EntityRefFallback, EntityRefHeader, lookupOptions } from "../parts";

export function MaintenanceWindowCard({ id }: { id: number }) {
  const trpc = useTRPC();
  const window = useQuery(
    trpc.maintenanceWindow.get.queryOptions({ id }, lookupOptions),
  );

  if (!window.data) {
    return (
      <EntityRefFallback kind="maintenanceWindow" id={id} query={window} />
    );
  }
  const { data } = window;
  const monitors = data.monitors.map((m) => m.name).join(", ");

  return (
    <EntityCard>
      <EntityRefHeader
        kind="maintenanceWindow"
        href={entityKinds.maintenanceWindow.href(data)}
      >
        {data.title}
      </EntityRefHeader>
      <EntityCardContent>
        <EntityCardRow label="Mode">
          {maintenanceWindowModeLabels[data.mode]}
        </EntityCardRow>
        <EntityCardRow label="Window" className="whitespace-normal">
          <time dateTime={data.from.toISOString()}>
            {formatDateRange(data.from, data.to)}
          </time>
        </EntityCardRow>
        {monitors ? (
          <EntityCardRow label="Monitors" title={monitors}>
            {monitors}
          </EntityCardRow>
        ) : null}
      </EntityCardContent>
    </EntityCard>
  );
}
