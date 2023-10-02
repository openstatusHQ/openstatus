import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  defaultMetadata,
  ogMetadata,
  twitterMetadata,
} from "@/app/shared-metadata";
import { Header } from "@/components/dashboard/header";
import { IncidentList } from "@/components/status-page/incident-list";
import { MonitorList } from "@/components/status-page/monitor-list";
import { api } from "@/trpc/server";

type Props = {
  params: { domain: string };
  searchParams: { [key: string]: string | string[] | undefined };
};

export default async function Page({ params }: Props) {
  // We should fetch the monitors and incident here
  // also the page information
  if (!params.domain) return notFound();
  const page = await api.page.getPageBySlug.query({ slug: params.domain });
  if (!page) {
    return notFound();
  }
  return (
    <div className="grid gap-6">
      <Header
        title={page.title}
        description={page.description}
        className="text-left"
      />
      <MonitorList monitors={page.monitors} />
      {page.monitors?.length > 0 ? (
        <IncidentList
          incidents={page.incidents}
          monitors={page.monitors}
          context="latest"
        />
      ) : null}
    </div>
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = await api.page.getPageBySlug.query({ slug: params.domain });
  const firstMonitor = page?.monitors?.[0]; // temporary solution

  return {
    ...defaultMetadata,
    title: page?.title,
    description: page?.description,
    icons: page?.icon,
    twitter: {
      ...twitterMetadata,
      images: [
        `/api/og?monitorId=${firstMonitor?.id}&title=${page?.title}&description=${
          page?.description || `The ${page?.title} status page`
        }`,
      ],
      title: page?.title,
      description: page?.description,
    },
    openGraph: {
      ...ogMetadata,
      images: [
        `/api/og?monitorId=${firstMonitor?.id}&title=${page?.title}&description=${
          page?.description || `The ${page?.title} status page`
        }`,
      ],
      title: page?.title,
      description: page?.description,
    },
  };
}
