import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { Suspense } from "react";

import { ButtonLink } from "../../../../../content/mdx-components/button-link";
import { CustomLink } from "../../../../../content/mdx-components/custom-link";
import { cachedGetExternalComponentBySlug } from "../../../../../lib/external-service-cache";
import {
  APP_URL,
  BASE_URL,
  defaultMetadata,
  ogMetadata,
  twitterMetadata,
} from "../../../../../lib/metadata/shared-metadata";
import { HydrateClient, api } from "../../../../../trpc/rq-server";
import {
  ContentBoxContainer,
  ContentBoxDescription,
  ContentBoxTitle,
} from "../../../content-box";
import { ComponentDetail } from "./component-detail";

export const dynamic = "force-dynamic";

const HISTORY_DAYS = 45;

type RouteParams = { id: string; component: string };

export async function generateMetadata(args: {
  params: Promise<RouteParams>;
}): Promise<Metadata> {
  const { id, component: componentParam } = await args.params;
  const { service, component } = await cachedGetExternalComponentBySlug(
    id,
    componentParam,
  );
  if (!service || !component) {
    return { ...defaultMetadata, title: "Not Found" };
  }

  const fullName = `${service.name} ${component.name}`;
  const title = `Is ${fullName} Down? ${fullName} Status & History`;
  const description = `Is ${component.name} (${service.name}) down right now? Check the live status, uptime over the last ${HISTORY_DAYS} days, and recent incidents for ${component.name} tracked by OpenStatus.`;
  const canonicalUrl = `${BASE_URL}/status/${service.slug}/${component.slug}`;
  const ogImage = `${BASE_URL}/api/og/external-service?slug=${encodeURIComponent(service.slug)}&component=${encodeURIComponent(component.slug)}`;
  const indexable = service.deletedAt == null && !component.stale;

  return {
    ...defaultMetadata,
    title,
    description,
    alternates: { canonical: canonicalUrl },
    robots: { index: indexable, follow: true },
    openGraph: {
      ...ogMetadata,
      title,
      description,
      url: canonicalUrl,
      images: [ogImage],
    },
    twitter: { ...twitterMetadata, title, description, images: [ogImage] },
  };
}

export default async function Page(args: { params: Promise<RouteParams> }) {
  const { id, component: componentParam } = await args.params;
  const { service, component } = await cachedGetExternalComponentBySlug(
    id,
    componentParam,
  );
  if (!service || !component) notFound();

  if (service.slug !== id) {
    permanentRedirect(`/status/${service.slug}/${componentParam}`);
  }
  if (component.slug !== componentParam) {
    permanentRedirect(`/status/${service.slug}/${component.slug}`);
  }

  await api.externalService.component.prefetch({
    serviceSlug: service.slug,
    componentSlug: component.slug,
    days: HISTORY_DAYS,
  });

  return (
    <section className="prose dark:prose-invert mb-12 max-w-none">
      <ContentBoxContainer className="not-prose my-6 px-4 py-2 text-sm">
        <CustomLink
          href={`${APP_URL}?ref=status-component-top`}
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
                Loading {service.name} {component.name} status…
              </p>
            </section>
          }
        >
          <ComponentDetail
            serviceSlug={service.slug}
            componentSlug={component.slug}
            days={HISTORY_DAYS}
          />
        </Suspense>
      </HydrateClient>

      <ContentBoxContainer className="not-prose bg-muted/30 mt-10 flex flex-col items-start gap-3">
        <ContentBoxTitle className="m-0! text-lg">
          Looking for a status page?
        </ContentBoxTitle>
        <ContentBoxDescription className="m-0! text-sm">
          Every service needs a status page. Run yours with OpenStatus.
        </ContentBoxDescription>
        <ButtonLink href={`${APP_URL}?ref=status-component-bottom`}>
          Create your status page
        </ButtonLink>
      </ContentBoxContainer>
    </section>
  );
}
