import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@openstatus/ui";

import {
  defaultMetadata,
  ogMetadata,
  twitterMetadata,
} from "@/app/shared-metadata";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Header } from "@/components/dashboard/header";
import { IncidentList } from "@/components/status-page/incident-list";
import { MonitorList } from "@/components/status-page/monitor-list";
import { api } from "@/trpc/server";

const url =
  process.env.NODE_ENV === "development"
    ? "http://localhost:3000"
    : "https://www.openstatus.dev";

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

  const isEmptyState = !(
    Boolean(page.monitors.length) || Boolean(page.incidents.length)
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
          <MonitorList monitors={page.monitors} />
          <IncidentList
            incidents={page.incidents}
            monitors={page.monitors}
            context="latest"
          />
        </>
      )}
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
