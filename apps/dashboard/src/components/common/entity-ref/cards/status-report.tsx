import { useQuery } from "@tanstack/react-query";

import {
  EntityCard,
  EntityCardContent,
  EntityCardRow,
} from "@/components/common/entity-card";
import { entityKinds } from "@/data/entity-refs.client";
import { useTRPC } from "@/lib/trpc/client";

import {
  EntityRefFallback,
  EntityRefHeader,
  RelativeTime,
  lookupOptions,
} from "../parts";

export function StatusReportCard({ id }: { id: number }) {
  const trpc = useTRPC();
  const report = useQuery(
    trpc.statusReport.get.queryOptions({ id }, lookupOptions),
  );

  if (!report.data) {
    return <EntityRefFallback kind="statusReport" id={id} query={report} />;
  }
  const { data } = report;
  const latest = data.updates[0];
  const components = data.pageComponents.map((c) => c.name).join(", ");

  return (
    <EntityCard>
      <EntityRefHeader
        kind="statusReport"
        href={
          data.pageId === null
            ? undefined
            : entityKinds.statusReport.href({ id, pageId: data.pageId })
        }
      >
        {data.title}
      </EntityRefHeader>
      <EntityCardContent>
        <EntityCardRow label="Status" className="capitalize">
          {data.status}
        </EntityCardRow>
        <EntityCardRow label="Page">{data.page.title}</EntityCardRow>
        {components ? (
          <EntityCardRow label="Components" title={components}>
            {components}
          </EntityCardRow>
        ) : null}
        {latest ? (
          <EntityCardRow label="Updated">
            <RelativeTime date={latest.date} />
          </EntityCardRow>
        ) : null}
      </EntityCardContent>
    </EntityCard>
  );
}
