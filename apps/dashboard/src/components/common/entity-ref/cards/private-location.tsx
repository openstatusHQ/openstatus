import { useQuery } from "@tanstack/react-query";

import {
  EntityCard,
  EntityCardContent,
  EntityCardRow,
} from "@/components/common/entity-card";
import { entityKinds, findById } from "@/data/entity-refs.client";
import { useTRPC } from "@/lib/trpc/client";

import { EntityRefFallback, EntityRefHeader, RelativeTime } from "../parts";

export function PrivateLocationCard({ id }: { id: number }) {
  const trpc = useTRPC();
  const location = useQuery({
    // Schema max; there is no `get`, so locations past the newest 100 show
    // "not found". Accepted: the settings page itself only lists 50.
    ...trpc.privateLocation.list.queryOptions({ limit: 100 }),
    select: findById(id),
  });

  if (!location.data) {
    return (
      <EntityRefFallback kind="privateLocation" id={id} query={location} />
    );
  }
  const { data } = location;

  return (
    <EntityCard>
      <EntityRefHeader
        kind="privateLocation"
        href={entityKinds.privateLocation.href()}
      >
        {data.name}
      </EntityRefHeader>
      <EntityCardContent>
        <EntityCardRow label="Status">
          {data.status === "active" ? "Online" : "Offline"}
        </EntityCardRow>
        <EntityCardRow label="Monitors">{data.monitors.length}</EntityCardRow>
        <EntityCardRow label="Last seen">
          {data.lastSeenAt ? <RelativeTime date={data.lastSeenAt} /> : "Never"}
        </EntityCardRow>
      </EntityCardContent>
    </EntityCard>
  );
}
