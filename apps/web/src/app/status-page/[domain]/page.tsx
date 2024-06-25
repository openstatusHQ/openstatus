import { subDays } from "date-fns";
import { notFound } from "next/navigation";

import { Separator } from "@openstatus/ui";

import { Header } from "@/components/dashboard/header";
import { MaintenanceBanner } from "@/components/status-page/maintenance-banner";
import { MonitorList } from "@/components/status-page/monitor-list";
import { StatusCheck } from "@/components/status-page/status-check";
import { StatusReportList } from "@/components/status-page/status-report-list";
import { api } from "@/trpc/server";

type Props = {
  params: { domain: string };
  searchParams: { [key: string]: string | string[] | undefined };
};

export const revalidate = 600;
export const maxDuration = 120;

export default async function Page({ params }: Props) {
  const page = await api.page.getPageBySlug.query({ slug: params.domain });
  if (!page) return notFound();

  const currentMaintenances = page.maintenances.filter(
    (maintenance) =>
      maintenance.to.getTime() > Date.now() &&
      maintenance.from.getTime() < Date.now(),
  );

  return (
    <div className="mx-auto flex w-full flex-col gap-8">
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
      {currentMaintenances.length ? (
        <div className="grid w-full gap-3">
          {currentMaintenances.map((maintenance) => (
            <MaintenanceBanner key={maintenance.id} {...maintenance} />
          ))}
        </div>
      ) : null}
      <MonitorList
        monitors={page.monitors}
        statusReports={page.statusReports}
        incidents={page.incidents}
        maintenances={page.maintenances}
      />
      <Separator />
      <div className="grid gap-6">
        <div>
          <h2 className="font-semibold text-xl">Last updates</h2>
          <p className="text-muted-foreground text-sm">
            Reports of the last 7 days or incidents that have not been resolved
            yet.
          </p>
        </div>
        <StatusReportList
          statusReports={page.statusReports}
          monitors={page.monitors}
          filter={{ date: subDays(Date.now(), 7), open: true }}
        />
      </div>
    </div>
  );
}
