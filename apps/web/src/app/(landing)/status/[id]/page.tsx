import { REPORT_WINDOW_MINUTES } from "@openstatus/api/src/router/effective-status";
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { Suspense } from "react";

import { ButtonLink } from "@/content/mdx-components/button-link";
import { CustomLink } from "@/content/mdx-components/custom-link";
import { getServiceEscalation } from "@/lib/external-report-escalation";
import { cachedGetExternalServiceBySlug } from "@/lib/external-service-cache";
import {
  APP_URL,
  BASE_URL,
  defaultMetadata,
  ogMetadata,
  twitterMetadata,
} from "@/lib/metadata/shared-metadata";
import { HydrateClient, api } from "@/trpc/rq-server";

import {
  ContentBoxContainer,
  ContentBoxDescription,
  ContentBoxTitle,
} from "../../content-box";
import { ServiceDetail } from "./service-detail";

export const dynamic = "force-dynamic";

const HISTORY_DAYS = 45;

type RouteParams = { id: string };

export async function generateMetadata(args: {
  params: Promise<RouteParams>;
}): Promise<Metadata> {
  const { id } = await args.params;
  try {
    const service = await cachedGetExternalServiceBySlug(id);
    if (!service) return { ...defaultMetadata, title: "Not Found" };

    const { escalated } = await getServiceEscalation(service);

    const title = escalated
      ? `Users reporting issues with ${service.name}. ${service.name} Status & Incidents`
      : `Is ${service.name} Down? ${service.name} Status & Incidents`;
    const description = escalated
      ? `Users are reporting problems with ${service.name} in the last ${REPORT_WINDOW_MINUTES} minutes. Check the live ${service.name} status, uptime over the last ${HISTORY_DAYS} days, and recent ${service.name} incidents tracked by OpenStatus.`
      : `Is ${service.name} down right now? Check the live ${service.name} status, uptime over the last ${HISTORY_DAYS} days, and recent ${service.name} incidents tracked by OpenStatus.`;
    const canonicalUrl = `${BASE_URL}/status/${service.slug}`;
    const ogImage = `${BASE_URL}/api/og/external-service?slug=${encodeURIComponent(service.slug)}`;
    const indexable = service.deletedAt == null;

    return {
      ...defaultMetadata,
      title,
      description,
      alternates: {
        canonical: canonicalUrl,
      },
      robots: {
        index: indexable,
        follow: true,
      },
      openGraph: {
        ...ogMetadata,
        title,
        description,
        url: canonicalUrl,
        images: [ogImage],
      },
      twitter: {
        ...twitterMetadata,
        title,
        description,
        images: [ogImage],
      },
    };
  } catch (err) {
    console.warn(`[status metadata] fallback for ${id}:`, err);
    return defaultMetadata;
  }
}

export default async function Page(args: { params: Promise<RouteParams> }) {
  const { id } = await args.params;
  const service = await cachedGetExternalServiceBySlug(id);
  if (!service) notFound();

  if (service.slug !== id) {
    permanentRedirect(`/status/${service.slug}`);
  }

  await Promise.all([
    api.externalService.detail.prefetch({
      slug: service.slug,
      days: HISTORY_DAYS,
    }),
    api.externalService.incidents.prefetch({ slug: service.slug }),
    api.externalService.components.prefetch({
      slug: service.slug,
      days: HISTORY_DAYS,
    }),
    api.externalService.reports.prefetch({
      slug: service.slug,
      days: HISTORY_DAYS,
    }),
  ]);

  return (
    <section className="prose dark:prose-invert mb-12 max-w-none">
      <ContentBoxContainer className="not-prose my-6 px-4 py-2 text-sm">
        <CustomLink
          href={`${APP_URL}?ref=status-service-top`}
          className="font-medium underline-offset-4 hover:underline"
        >
          Catch downtime instantly and keep your users in the loop with
          OpenStatus →
        </CustomLink>
      </ContentBoxContainer>

      <HydrateClient>
        <Suspense
          fallback={
            <section className="prose dark:prose-invert mb-12 max-w-none">
              <p className="text-muted-foreground">
                Loading {service.name} status…
              </p>
            </section>
          }
        >
          <ServiceDetail slug={service.slug} days={HISTORY_DAYS} />
        </Suspense>
      </HydrateClient>

      <ContentBoxContainer className="not-prose bg-muted/30 mt-10 flex flex-col items-start gap-3">
        <ContentBoxTitle className="m-0! text-lg">
          Looking for a status page?
        </ContentBoxTitle>
        <ContentBoxDescription className="m-0! text-sm">
          Every service needs a status page. Run yours with OpenStatus.
        </ContentBoxDescription>
        <ButtonLink href={`${APP_URL}?ref=status-service-bottom`}>
          Create your status page
        </ButtonLink>
      </ContentBoxContainer>
    </section>
  );
}
