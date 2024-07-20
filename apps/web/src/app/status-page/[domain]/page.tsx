import { subDays } from "date-fns";
import { notFound } from "next/navigation";

import { Header } from "@/components/dashboard/header";
import { MaintenanceBanner } from "@/components/status-page/maintenance-banner";
import { MonitorList } from "@/components/status-page/monitor-list";
import { StatusCheck } from "@/components/status-page/status-check";
import { api } from "@/trpc/server";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Feed } from "@/components/status-page/feed";
import { Separator } from "@openstatus/ui";

type Props = {
  params: { domain: string };
  searchParams: { [key: string]: string | string[] | undefined };
};

export const revalidate = 120;

export default async function Page({ params }: Props) {
  const page = await api.page.getPageBySlug.query({ slug: params.domain });
  if (!page) return notFound();

  const currentMaintenances = page.maintenances.filter(
    (maintenance) =>
      maintenance.to.getTime() > Date.now() &&
      maintenance.from.getTime() < Date.now()
  );

  const lastMaintenances = page.maintenances.filter((maintenance) => {
    return maintenance.from.getTime() > subDays(new Date(), 7).getTime();
  });

  const lastStatusReports = page.statusReports.filter((report) => {
    return report.statusReportUpdates.some(
      (update) => update.date.getTime() > subDays(new Date(), 7).getTime()
    );
  });

  return (
    <div className="mx-auto flex w-full flex-col gap-12">
      <Header
        title={page.title}
        description={page.description}
        className="text-left"
      />
      <StatusCheck
        statusReports={page.statusReports}
        incidents={page.incidents}
        maintenances={page.maintenances}
      />
      {page.monitors.length ? (
        <MonitorList
          monitors={page.monitors}
          statusReports={page.statusReports}
          incidents={page.incidents}
          maintenances={page.maintenances}
        />
      ) : (
        <EmptyState
          icon="activity"
          title="No monitors"
          description="The status page has no connected monitors."
        />
      )}
      <Separator />
      {lastStatusReports.length || lastMaintenances.length ? (
        <Feed
          monitors={page.monitors}
          maintenances={lastMaintenances.filter((maintenance) => {
            return (
              maintenance.from.getTime() > subDays(new Date(), 7).getTime()
            );
          })}
          statusReports={lastStatusReports.filter((report) => {
            return report.statusReportUpdates.some(
              (update) =>
                update.date.getTime() > subDays(new Date(), 7).getTime()
            );
          })}
        />
      ) : (
        <EmptyState
          icon="siren"
          title="No latest incidents"
          description="There have been no incidents within the last 7 days."
        />
      )}
    </div>
  );
}
