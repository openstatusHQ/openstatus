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
  markdownAlternate,
  ogMetadata,
  twitterMetadata,
} from "../../../../../lib/metadata/shared-metadata";
import { HydrateClient, api } from "../../../../../trpc/rq-server";
import {
  ContentBoxContainer,
  ContentBoxDescription,
  ContentBoxTitle,
} from "../../../content-box";
import { prefetchPopularStatus } from "../../prefetch";
import { PopularStatus } from "../../sections";
import { AgentHint } from "../../service-blocks";
import { getCheckerHref, getComponentFullName, getHost } from "../../utils";
import { ComponentDetail } from "./client";

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

  const fullName = getComponentFullName(service.name, component.name);
  const title = `Is ${fullName} Down? ${fullName} Status & History`;
  const description = `Is ${component.name} (${service.name}) down right now? Check the live status, uptime over the last ${HISTORY_DAYS} days, and recent incidents for ${component.name}, part of the ${service.name} status tracked by openstatus.`;
  const canonicalUrl = `${BASE_URL}/status/${service.slug}/${component.slug}`;
  const ogImage = `${BASE_URL}/api/og/external-service?slug=${encodeURIComponent(service.slug)}&component=${encodeURIComponent(component.slug)}`;
  const indexable = service.deletedAt == null && !component.stale;

  return {
    ...defaultMetadata,
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
      ...markdownAlternate(`/status/${service.slug}/${component.slug}`),
    },
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

  const fullName = getComponentFullName(service.name, component.name);

  await Promise.all([
    api.externalService.component.prefetch({
      serviceSlug: service.slug,
      componentSlug: component.slug,
      days: HISTORY_DAYS,
    }),
    // Sibling list is rendered on the server so its links are crawlable.
    api.externalService.components.prefetch({ slug: service.slug, days: 1 }),
    prefetchPopularStatus(),
  ]);

  const checkerHref = getCheckerHref(service.url);
  const checker = checkerHref
    ? { href: checkerHref, host: getHost(service.url) }
    : null;

  return (
    <section className="prose dark:prose-invert mb-12 flex max-w-none flex-col gap-10">
      <HydrateClient>
        <Suspense
          fallback={
            <section className="prose dark:prose-invert mb-12 max-w-none">
              <p className="text-muted-foreground">
                Loading {fullName} status…
              </p>
            </section>
          }
        >
          <ComponentDetail
            serviceSlug={service.slug}
            componentSlug={component.slug}
            days={HISTORY_DAYS}
            checker={checker}
          />
        </Suspense>
        <Suspense fallback={null}>
          <PopularStatus
            id="related"
            title="People also check"
            aside={null}
            exclude={{ service: service.slug, component: component.slug }}
            limit={8}
          />
        </Suspense>
      </HydrateClient>

      <AgentHint
        markdownPath={`/status/${service.slug}/${component.slug}.md`}
      />

      <ContentBoxContainer className="not-prose bg-muted/30 flex flex-col items-start gap-3">
        <ContentBoxTitle className="m-0! text-lg">
          Looking for a status page?
        </ContentBoxTitle>
        <ContentBoxDescription className="m-0! text-sm">
          Every service needs a status page. Run yours with openstatus — see
          what a{" "}
          <CustomLink href="/status-page" className="underline-offset-4">
            hosted status page
          </CustomLink>{" "}
          includes.
        </ContentBoxDescription>
        <ButtonLink href={`${APP_URL}?ref=status-component-bottom`}>
          Create your status page
        </ButtonLink>
      </ContentBoxContainer>
    </section>
  );
}
