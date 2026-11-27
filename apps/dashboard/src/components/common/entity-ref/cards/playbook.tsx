import { useQuery } from "@tanstack/react-query";

import {
  EntityCard,
  EntityCardContent,
  EntityCardRow,
} from "@/components/common/entity-card";
import { entityKinds, findById } from "@/data/entity-refs.client";
import { useTRPC } from "@/lib/trpc/client";

import { EntityRefFallback, EntityRefHeader } from "../parts";

export function PlaybookCard({ id }: { id: number }) {
  const trpc = useTRPC();
  const playbook = useQuery({
    ...trpc.playbook.list.queryOptions(),
    select: findById(id),
  });

  if (!playbook.data) {
    return <EntityRefFallback kind="playbook" id={id} query={playbook} />;
  }
  const { data } = playbook;

  return (
    <EntityCard>
      <EntityRefHeader kind="playbook" href={entityKinds.playbook.href(data)}>
        {data.title}
      </EntityRefHeader>
      <EntityCardContent>
        <EntityCardRow label="Slug" className="font-mono">
          {data.slug}
        </EntityCardRow>
        <EntityCardRow label="Covers" className="whitespace-normal">
          {data.description}
        </EntityCardRow>
      </EntityCardContent>
    </EntityCard>
  );
}
