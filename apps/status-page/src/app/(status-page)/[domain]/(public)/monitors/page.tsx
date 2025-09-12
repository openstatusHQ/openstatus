"use client";

import {
  ChartAreaPercentiles,
  ChartAreaPercentilesSkeleton,
} from "@/components/chart/chart-area-percentiles";
import {
  EmptyStateContainer,
  EmptyStateDescription,
  EmptyStateTitle,
} from "@/components/content/empty-state";
import { useStatusPage } from "@/components/status-page/floating-button";
import {
  Status,
  StatusContent,
  StatusDescription,
  StatusHeader,
  StatusTitle,
} from "@/components/status-page/status";
import { StatusMonitorTitle } from "@/components/status-page/status-monitor";
import { StatusMonitorDescription } from "@/components/status-page/status-monitor";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function Page() {
  const { variant } = useStatusPage();
  const { domain } = useParams<{ domain: string }>();
  const trpc = useTRPC();
  const { data: page } = useQuery(
    trpc.statusPage.get.queryOptions({ slug: domain }),
  );
  const { data: monitors, isLoading } = useQuery(
    trpc.statusPage.getMonitors.queryOptions({ slug: domain }),
  );

  if (!page) return null;

  return (
    <Status variant={variant}>
      <StatusHeader>
        <StatusTitle>{page.title}</StatusTitle>
        <StatusDescription>{page.description}</StatusDescription>
      </StatusHeader>
      <StatusContent className="flex flex-col gap-6">
        {page.monitors.length > 0 ? (
          page.monitors
            .filter((monitor) => monitor.public)
            .map((monitor) => {
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
                    <div className="flex flex-row items-center gap-2">
                      <StatusMonitorTitle>{monitor.name}</StatusMonitorTitle>
                      <StatusMonitorDescription>
                        {monitor.description}
                      </StatusMonitorDescription>
                    </div>
                    {isLoading ? (
                      <ChartAreaPercentilesSkeleton className="h-[80px]" />
                    ) : (
                      <ChartAreaPercentiles
                        className="h-[80px]"
                        legendClassName="pb-1"
                        data={data}
                        singleSeries
                      />
                    )}
                  </div>
                </Link>
              );
            })
        ) : (
          <EmptyStateContainer>
            <EmptyStateTitle>No public monitors</EmptyStateTitle>
            <EmptyStateDescription>
              No public monitors have been added to this page.
            </EmptyStateDescription>
          </EmptyStateContainer>
        )}
      </StatusContent>
    </Status>
  );
}
