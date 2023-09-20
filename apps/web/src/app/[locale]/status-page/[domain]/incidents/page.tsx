import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  defaultMetadata,
  ogMetadata,
  twitterMetadata,
} from "@/app/shared-metadata";
import { Header } from "@/components/dashboard/header";
import { IncidentList } from "@/components/status-page/incident-list";
import { api } from "@/trpc/server";
import { getI18n } from '@/yuzu/server';

type Props = {
  params: { domain: string };
  searchParams: { [key: string]: string | string[] | undefined };
};

export default async function Page({ params }: Props) {
  if (!params.domain) return notFound();

  const page = await api.page.getPageBySlug.query({ slug: params.domain });
  if (!page) return notFound();

  return (
    <div className="grid gap-6">
      <Header
        title={page.title}
        description={page.description}
        className="text-left"
      />
      <IncidentList incidents={page.incidents} monitors={page.monitors} />
    </div>
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = await api.page.getPageBySlug.query({ slug: params.domain });
  const firstMonitor = page?.monitors?.[0]; // temporary solution

  const t = await getI18n()

  return {
    ...defaultMetadata,
    title: page?.title,
    description: page?.description,
    icons: page?.icon,
    twitter: {
      ...twitterMetadata,
      images: [
        `/api/og?monitorId=${firstMonitor?.id}&title=${page?.title}&description=${
          page?.description || `${t('The')} ${page?.title} ${t('status page')}}`
        }`,
      ],
      title: page?.title,
      description: page?.description,
    },
    openGraph: {
      ...ogMetadata,
      images: [
        `/api/og?monitorId=${firstMonitor?.id}&title=${page?.title}&description=${
          page?.description || `${t('The')} ${page?.title} ${t('status page')}}`
        }`,
      ],
      title: page?.title,
      description: page?.description,
    },
  };
}
