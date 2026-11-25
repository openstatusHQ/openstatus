import { useQuery } from "@tanstack/react-query";

import {
  EntityCard,
  EntityCardContent,
  EntityCardRow,
} from "@/components/common/entity-card";
import { entityKinds, findById } from "@/data/entity-refs.client";
import { useTRPC } from "@/lib/trpc/client";

import { EntityRefFallback, EntityRefHeader } from "../parts";

export function NotificationCard({ id }: { id: number }) {
  const trpc = useTRPC();
  const notification = useQuery({
    ...trpc.notification.list.queryOptions(),
    select: findById(id),
  });

  if (!notification.data) {
    return (
      <EntityRefFallback kind="notification" id={id} query={notification} />
    );
  }
  const { data } = notification;
  const monitors = data.monitors.map((m) => m.name).join(", ");

  return (
    <EntityCard>
      <EntityRefHeader
        kind="notification"
        href={entityKinds.notification.href()}
      >
        {data.name}
      </EntityRefHeader>
      <EntityCardContent>
        {/* Raw provider id: the provider config would pull every notifier form into this bundle. */}
        <EntityCardRow label="Provider">{data.provider}</EntityCardRow>
        <EntityCardRow label="Monitors" title={monitors || undefined}>
          {monitors || "None"}
        </EntityCardRow>
      </EntityCardContent>
    </EntityCard>
  );
}
