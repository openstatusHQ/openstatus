import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@openstatus/ui/src/components/button";

import { EmptyState } from "@/components/dashboard/empty-state";
import { Header } from "@/components/dashboard/header";
import { SimpleChart } from "@/components/monitor-charts/simple-chart";
import { groupDataByTimestamp } from "@/components/monitor-charts/utils";
import { prepareMetricByIntervalByPeriod } from "@/lib/tb";
import { api } from "@/trpc/server";
import { searchParamsCache } from "./search-params";

// Add loading page

export const revalidate = 120;

export default async function Page(props: {
  params: Promise<{ domain: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const page = await api.page.getPageBySlug.query({ slug: params.domain });
  const { quantile, period } = searchParamsCache.parse(searchParams);

  if (!page) notFound();

  // filter monitor by public or not

  const publicMonitors = page.monitors.filter((monitor) => monitor.public);

  const monitorsWithData =
    publicMonitors.length > 0
      ? await Promise.all(
          publicMonitors?.map(async (monitor) => {
            const type = monitor.jobType as "http" | "tcp";
            const data = await prepareMetricByIntervalByPeriod(
              period,
              type,
            ).getData({
              monitorId: String(monitor.id),
              interval: 60,
            });

            return { monitor, data };
          }),
        )
      : undefined;

  return (
    <div className="grid gap-8">
      <Header
        title={page.title}
        description={page.description}
        className="text-left"
      />
      {monitorsWithData ? (
        <div className="grid gap-6">
          <p className="text-muted-foreground">
            Response time over the{" "}
            <span className="font-medium text-foreground">last {period}</span>{" "}
            across{" "}
            <span className="font-medium text-foreground">
              all selected regions
            </span>{" "}
            within a{" "}
            <span className="font-medium text-foreground">p95 quantile</span>.
          </p>
          <ul className="grid gap-6">
            {monitorsWithData?.map(({ monitor, data }) => {
              const group =
                data.data && groupDataByTimestamp(data.data, period, quantile);
              return (
                <li key={monitor.id} className="grid gap-2">
                  <div className="flex w-full min-w-0 items-center justify-between gap-3">
                    <div className="w-full min-w-0">
                      <p className="font-semibold text-sm">{monitor.name}</p>
                      <p className="truncate text-muted-foreground text-sm">
                        {monitor.url}
                      </p>
                    </div>
                    <Button variant="link" size="sm" asChild>
                      <Link href={`./monitors/${monitor.id}`}>
                        Details <ChevronRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                  {group ? (
                    <SimpleChart
                      data={group.data.map((d) => ({
                        timestamp: d.timestamp,
                        // REMINDER: select first region as default
                        // TODO: we could create an average of all regions instead
                        latency: d[monitor.regions?.[0]],
                      }))}
                    />
                  ) : (
                    <p>missing data</p>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <EmptyState
          icon="activity"
          title="No public monitors"
          description="No public monitors have been added to this page."
        />
      )}
    </div>
  );
}
