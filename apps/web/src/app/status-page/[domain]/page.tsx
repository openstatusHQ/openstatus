import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Header } from "@/components/dashboard/header";
import { Shell } from "@/components/dashboard/shell";
import { MonitorList } from "@/components/status-page/monitor-list";
import { api } from "@/trpc/server";

type Props = {
  params: { domain: string };
  searchParams: { [key: string]: string | string[] | undefined };
};

export default async function Page({ params }: Props) {
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
          className="mx-auto max-w-lg lg:mx-auto"
        />
        <MonitorList monitors={page.monitors} />
      </div>
    </Shell>
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = await api.page.getPageBySlug.query({ slug: params.domain });
  const firstMonitor = page?.monitors?.[0]; // temporary solution

  return {
    title: page?.title,
    description: page?.description,
    twitter: {
      images: [
        `/api/og?monitorId=${firstMonitor?.id}&title=${page?.title}&description=${
          page?.description || `The ${page?.title} status page}`
        }`,
      ],
      card: "summary_large_image",
      title: page?.title,
      description: page?.description,
    },
    openGraph: {
      type: "website",
      images: [
        `/api/og?monitorId=${firstMonitor?.id}&title=${page?.title}&description=${
          page?.description || `The ${page?.title} status page}`
        }`,
      ],
      title: page?.title,
      description: page?.description,
    },
  };
}
