import { useQuery } from "@tanstack/react-query";

import {
  EntityCard,
  EntityCardContent,
  EntityCardRow,
} from "@/components/common/entity-card";
import { entityKinds, findById } from "@/data/entity-refs.client";
import { useTRPC } from "@/lib/trpc/client";

import { EntityRefFallback, EntityRefHeader } from "../parts";

export function PageComponentCard({ id }: { id: number }) {
  const trpc = useTRPC();
  const component = useQuery({
    ...trpc.pageComponent.list.queryOptions(),
    select: findById(id),
  });
  const page = useQuery({
    ...trpc.page.list.queryOptions(),
    select: findById(component.data?.pageId ?? 0),
    enabled: component.data !== undefined,
  });

  if (!component.data) {
    return <EntityRefFallback kind="pageComponent" id={id} query={component} />;
  }
  const { data } = component;

  return (
    <EntityCard>
      <EntityRefHeader
        kind="pageComponent"
        href={entityKinds.pageComponent.href(data)}
      >
        {data.name}
      </EntityRefHeader>
      <EntityCardContent>
        <EntityCardRow label="Type">
          {data.type === "monitor" ? "Monitor" : "Static"}
        </EntityCardRow>
        {page.data ? (
          <EntityCardRow label="Page">{page.data.title}</EntityCardRow>
        ) : null}
        {data.group ? (
          <EntityCardRow label="Group">{data.group.name}</EntityCardRow>
        ) : null}
        {data.monitor ? (
          <EntityCardRow label="Monitor">{data.monitor.name}</EntityCardRow>
        ) : null}
      </EntityCardContent>
    </EntityCard>
  );
}
