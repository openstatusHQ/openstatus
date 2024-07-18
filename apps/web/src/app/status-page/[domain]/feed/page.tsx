import { api } from "@/trpc/server";
import { notFound } from "next/navigation";
import { Header } from "@/components/dashboard/header";
import { StatusReportList } from "@/components/status-page/status-report-list";
import { MaintenanceList } from "@/components/status-page/maintenance-list";
import { Feed } from "@/components/status-page/feed";

type Props = {
  params: { domain: string };
  searchParams: { [key: string]: string | string[] | undefined };
};

export const revalidate = 120;

export default async function Page({ params }: Props) {
  const page = await api.page.getPageBySlug.query({ slug: params.domain });
  if (!page) return notFound();

  return (
    <div className="grid gap-8">
      <Header
        title={page.title}
        description={page.description}
        className="text-left"
      />
      <Feed
        maintenances={page.maintenances}
        monitors={page.monitors}
        statusReports={page.statusReports}
      />
    </div>
  );
}
