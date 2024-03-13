import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@openstatus/ui";

import { EmptyState } from "@/components/dashboard/empty-state";
import { Header } from "@/components/dashboard/header";
import { MonitorList } from "@/components/status-page/monitor-list";
import { StatusCheck } from "@/components/status-page/status-check";
import { StatusReportList } from "@/components/status-page/status-report-list";
import { api } from "@/trpc/server";

const url =
  process.env.NODE_ENV === "development"
    ? "http://localhost:3000"
    : "https://www.openstatus.dev";

type Props = {
  params: { domain: string };
  searchParams: { [key: string]: string | string[] | undefined };
};

export const revalidate = 600;

export default async function Page({ params }: Props) {
  const page = await api.page.getPageBySlug.query({ slug: params.domain });
  if (!page) return notFound();
  const isEmptyState = !(
    Boolean(page.monitors.length) || Boolean(page.statusReports.length)
  );

  return (
    <div className="mx-auto flex w-full flex-col gap-6">
      <Header
        title={page.title}
        description={page.description}
        className="text-left"
      />
      {isEmptyState ? (
        <EmptyState
          icon="activity"
          title="Missing Monitors"
          description="Fill your status page with monitors."
          action={
            <Button asChild>
              <Link href={`${url}/app`}>Go to Dashboard</Link>
            </Button>
          }
        />
      ) : (
        <>
          <StatusCheck
            statusReports={page.statusReports}
            incidents={page.incidents}
          />
          <MonitorList
            monitors={page.monitors}
            statusReports={page.statusReports}
            incidents={page.incidents}
          />
          <StatusReportList
            statusReports={page.statusReports}
            monitors={page.monitors}
            context="latest"
          />
        </>
      )}
    </div>
  );
}
