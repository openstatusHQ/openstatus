import { useQuery } from "@tanstack/react-query";

import {
  EntityCard,
  EntityCardContent,
  EntityCardRow,
} from "@/components/common/entity-card";
import { entityKinds } from "@/data/entity-refs.client";
import { useTRPC } from "@/lib/trpc/client";

import { EntityRefFallback, EntityRefHeader } from "../parts";

export function IncidentResponseTargetCard({ id }: { id: number }) {
  const trpc = useTRPC();
  // one configuration per workspace: an older id means it was deleted and saved again
  const policy = useQuery({
    ...trpc.incidentResponseTarget.get.queryOptions(),
    select: (row) => (row?.id === id ? row : undefined),
  });

  if (!policy.data) {
    return (
      <EntityRefFallback kind="incidentResponseTarget" id={id} query={policy} />
    );
  }
  const { data } = policy;

  return (
    <EntityCard>
      <EntityRefHeader
        kind="incidentResponseTarget"
        href={entityKinds.incidentResponseTarget.href()}
      >
        Incident response targets
      </EntityRefHeader>
      <EntityCardContent>
        <EntityCardRow label="Response met by">
          {data.responseMet === "status_report"
            ? "First status report update"
            : "Acknowledgement"}
        </EntityCardRow>
        <EntityCardRow label="Resolution stops at">
          {data.resolutionStop === "mitigated" ? "Mitigated" : "Resolved"}
        </EntityCardRow>
      </EntityCardContent>
    </EntityCard>
  );
}
