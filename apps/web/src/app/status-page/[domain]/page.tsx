import { subDays } from "date-fns";
import { notFound } from "next/navigation";

import { Separator } from "@openstatus/ui";

import { Header } from "@/components/dashboard/header";
import { MonitorList } from "@/components/status-page/monitor-list";
import { StatusCheck } from "@/components/status-page/status-check";
import { StatusReportList } from "@/components/status-page/status-report-list";
import { api } from "@/trpc/server";

type Props = {
  params: { domain: string };
  searchParams: { [key: string]: string | string[] | undefined };
};

export const revalidate = 600;

export default async function Page({ params }: Props) {
  const page = await api.page.getPageBySlug.query({ slug: params.domain });
  if (!page) return notFound();

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
      />
      <MonitorList
        monitors={page.monitors}
        statusReports={page.statusReports}
        incidents={page.incidents}
      />
      <Separator />
      <div className="grid gap-6">
        <div>
          <h2 className="font-semibold text-xl">Latest Incidents</h2>
          <p className="text-muted-foreground text-sm">
            Incidents of the last 7 days or that have not been resolved yet.
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
