"use client";

import {
  StatusComponentDescription,
  StatusComponentTitle,
} from "@openstatus/ui/components/blocks/status-component";
import {
  Status,
  StatusContent,
  StatusDescription,
  StatusHeader,
  StatusTitle,
} from "@openstatus/ui/components/blocks/status-layout";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";

import {
  ChartAreaPercentiles,
  ChartAreaPercentilesSkeleton,
} from "../../../../../../components/chart/chart-area-percentiles";
import { StatusBlankMonitors } from "../../../../../../components/status-page/status-blank";
import { useTRPC } from "../../../../../../lib/trpc/client";

export default function Page() {
  const { domain } = useParams<{ domain: string }>();
  const trpc = useTRPC();
  const { data: page } = useQuery(
    trpc.statusPage.get.queryOptions({ slug: domain }),
  );
  const { data: monitors, isLoading } = useQuery(
    trpc.statusPage.getMonitors.queryOptions({ slug: domain }),
  );

  if (!page) return null;

  // Precompute group minimum order map for O(n log n) sorting performance
  const groupMinOrderMap = new Map<number, number>();
  for (const monitor of page.monitors) {
    const groupId = monitor.monitorGroupId;
    if (groupId !== null) {
      const order = monitor.order ?? 0;
      const currentMin = groupMinOrderMap.get(groupId) ?? Number.MAX_SAFE_INTEGER;
      groupMinOrderMap.set(groupId, Math.min(currentMin, order));
    }
  }

  const publicMonitors = page.monitors
    .filter((monitor) => monitor.public)
    .sort((a, b) => {
      // Sort by group position first, then by groupOrder within each group
      const aGroupId = a.monitorGroupId ?? null;
      const bGroupId = b.monitorGroupId ?? null;

      // If both monitors are in the same group (or both ungrouped with null)
      if (aGroupId === bGroupId) {
        if (aGroupId === null) {
          // Both ungrouped - sort by order to match trackers behavior
          return (a.order ?? 0) - (b.order ?? 0);
        }
        // Both in same group - sort by groupOrder within the group
        return (a.groupOrder ?? 0) - (b.groupOrder ?? 0);
      }

      // Different groups or one is ungrouped - sort by group position
      // For grouped monitors, use precomputed minimum order of the group
      // For ungrouped monitors, use their own order
      const aGroupMinOrder =
        aGroupId !== null ? groupMinOrderMap.get(aGroupId) ?? 0 : (a.order ?? 0);

      const bGroupMinOrder =
        bGroupId !== null ? groupMinOrderMap.get(bGroupId) ?? 0 : (b.order ?? 0);

      return aGroupMinOrder - bGroupMinOrder;
    });



  return (
    <Status>
      <StatusHeader>
        <StatusTitle>{page.title}</StatusTitle>
        <StatusDescription>{page.description}</StatusDescription>
      </StatusHeader>
      <StatusContent className="flex flex-col gap-6">
        {publicMonitors.length > 0 ? (
          publicMonitors.map((monitor) => {
            const data =
              monitors
                ?.find((item) => item.id === monitor.id)
                ?.data?.map((item) => ({
                  ...item,
                  // TODO: create formatter
                  timestamp: new Date(item.timestamp).toLocaleString(
                    "default",
                    {
                      day: "numeric",
                      month: "short",
                      hour: "numeric",
                      minute: "numeric",
                      timeZoneName: "short",
                    },
                  ),
                })) ?? [];

            return (
              <Link
                key={monitor.id}
                href={`./monitors/${monitor.id}`}
                className="rounded-lg"
              >
                <div className="group hover:border-border/50 hover:bg-muted/50 -mx-3 -my-2 flex flex-col gap-2 rounded-lg border border-transparent px-3 py-2">
                  <div className="flex flex-row items-center justify-start gap-2">
                    <StatusComponentTitle>{monitor.name}</StatusComponentTitle>
                    <StatusComponentDescription>
                      {monitor.description}
                    </StatusComponentDescription>
                  </div>
                  {isLoading ? (
                    <ChartAreaPercentilesSkeleton className="h-[80px]" />
                  ) : (
                    <ChartAreaPercentiles
                      className="h-[80px]"
                      legendClassName="pb-1 justify-start"
                      data={data}
                      singleSeries
                    />
                  )}
                </div>
              </Link>
            );
          })
        ) : (
          <StatusBlankMonitors />
        )}
      </StatusContent>
    </Status>
  );
}
