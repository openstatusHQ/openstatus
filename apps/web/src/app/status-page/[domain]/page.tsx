import { notFound } from "next/navigation";

import { Header } from "@/components/dashboard/header";
import { Shell } from "@/components/dashboard/shell";
import { MonitorList } from "@/components/status-page/monitor-list";
import { api } from "@/trpc/server";

export default async function Page({ params }: { params: { domain: string } }) {
  // We should fetch the the monitors and incident here
  // also the page information
  if (!params.domain) return notFound();
  const page = await api.page.getPageBySlug.query({ slug: params.domain });
  if (!page) {
    return notFound();
  }

  return (
    <Shell>
      <div className="grid gap-6">
        <Header
          title={page.title}
          description={page.description}
          className="max-w-lg"
        />
        <MonitorList monitors={page.monitors} />
      </div>
    </Shell>
  );
}
