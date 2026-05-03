"use client";

import {
  ChartAreaPercentiles,
  ChartAreaPercentilesSkeleton,
} from "@/components/chart/chart-area-percentiles";
import { StatusBlankMonitors } from "@/components/status-page/status-blank";
import { useTRPC } from "@/lib/trpc/client";
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

  const publicMonitors = page.monitors.filter((monitor) => monitor.public);

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
                <div className="group -mx-3 -my-2 flex flex-col gap-2 rounded-lg border border-transparent px-3 py-2 hover:border-border/50 hover:bg-muted/50">
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
