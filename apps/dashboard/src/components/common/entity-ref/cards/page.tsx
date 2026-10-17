import { Skeleton } from "@openstatus/ui/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";

import {
  EntityCard,
  EntityCardContent,
  EntityCardRow,
} from "@/components/common/entity-card";
import { entityKinds, findById } from "@/data/entity-refs.client";
import { useTRPC } from "@/lib/trpc/client";

import { EntityRefFallback, EntityRefHeader } from "../parts";

export function PageCard({ id }: { id: number }) {
  const trpc = useTRPC();
  const page = useQuery({
    ...trpc.page.list.queryOptions(),
    select: findById(id),
  });
  const components = useQuery({
    ...trpc.pageComponent.list.queryOptions(),
    select: (rows) => rows?.filter((c) => c.pageId === id).length,
  });

  if (!page.data) {
    return <EntityRefFallback kind="page" id={id} query={page} />;
  }
  const { data } = page;

  return (
    <EntityCard>
      <EntityRefHeader kind="page" href={entityKinds.page.href(data)}>
        {data.title}
      </EntityRefHeader>
      <EntityCardContent>
        <EntityCardRow label="Slug">{data.slug}</EntityCardRow>
        {data.customDomain ? (
          <EntityCardRow label="Domain">{data.customDomain}</EntityCardRow>
        ) : null}
        <EntityCardRow label="Components">
          {components.data ?? <Skeleton className="ml-auto h-4 w-6" />}
        </EntityCardRow>
      </EntityCardContent>
    </EntityCard>
  );
}
