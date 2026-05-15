import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { Suspense } from "react";

import { ExternalServicePill } from "@/app/(landing)/status/external-service-pill";
import { env } from "@/env";
import {
  cachedGetExternalServiceBySlug,
  cachedListExternalServiceSlugs,
} from "@/lib/external-service-cache";
import {
  BASE_URL,
  defaultMetadata,
  ogMetadata,
  twitterMetadata,
} from "@/lib/metadata/shared-metadata";
import { OSTinybird, safePipeData } from "@openstatus/tinybird";

import { formatRelative, getStatusAnswer, isStale } from "../utils";
import { HistoryBars } from "./history-bars";
import { Incidents } from "./incidents";

export const revalidate = 60;
export const dynamicParams = true;

const HISTORY_DAYS = 45;

export async function generateStaticParams() {
  const { canonical } = await cachedListExternalServiceSlugs();
  return canonical.map((id) => ({ id }));
}

type RouteParams = { id: string };

export async function generateMetadata(args: { params: Promise<RouteParams> }): Promise<Metadata> {
  const { id } = await args.params;
  const service = await cachedGetExternalServiceBySlug(id);
  if (!service) return { ...defaultMetadata, title: "Not Found" };

  const title = `Is ${service.name} Down? ${service.name} Status & Incidents`;
  const description = `Is ${service.name} down right now? Check the live ${service.name} status, uptime over the last ${HISTORY_DAYS} days, and recent ${service.name} incidents tracked by OpenStatus.`;
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
}

function jsonLd(args: {
  serviceName: string;
  serviceUrl: string;
  canonicalUrl: string;
  answer: string;
}) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Service",
        name: args.serviceName,
        url: args.serviceUrl,
      },
      {
        "@type": "WebPage",
        url: args.canonicalUrl,
        name: `${args.serviceName} Status`,
      },
      {
        "@type": "FAQPage",
        mainEntity: [
          {
            "@type": "Question",
            name: `Is ${args.serviceName} down?`,
            acceptedAnswer: {
              "@type": "Answer",
              text: args.answer,
            },
          },
        ],
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "External Status",
            item: `${BASE_URL}/status`,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: args.serviceName,
            item: args.canonicalUrl,
          },
        ],
      },
    ],
  };
}

export default async function Page(args: { params: Promise<RouteParams> }) {
  const { id } = await args.params;
  const service = await cachedGetExternalServiceBySlug(id);
  if (!service) notFound();

  if (service.slug !== id) {
    permanentRedirect(`/status/${service.slug}`);
  }

  const aliasSlugs = Array.isArray(service.aliases) ? service.aliases : [];
  const slugChain = [service.slug, ...aliasSlugs];

  const tb = new OSTinybird(env.TINY_BIRD_API_KEY);
  const [latestRes, historyRes] = await Promise.all([
    safePipeData(tb.externalStatusLatest({ ids: slugChain }), "externalStatusLatest"),
    safePipeData(
      tb.externalStatusHistory({ ids: slugChain, days: HISTORY_DAYS }),
      "externalStatusHistory",
    ),
  ]);

  const latestRows = Array.isArray(latestRes.data) ? latestRes.data : [];
  latestRows.sort((a, b) => b.last_fetched_at - a.last_fetched_at);
  const latest = latestRows[0];

  const historyRows = Array.isArray(historyRes.data) ? historyRes.data : [];

  const indicator = latest?.indicator ?? "";
  const status = latest?.status ?? "";
  const statusMessage = latest?.status_message ?? undefined;
  const fetchedAt = latest?.last_fetched_at ?? 0;
  const stale = fetchedAt > 0 && isStale(fetchedAt);
  const hasLiveData = fetchedAt > 0 && !stale;
  const answer = getStatusAnswer({
    name: service.name,
    indicator,
    status,
    hasLiveData,
  });

  const canonicalUrl = `${BASE_URL}/status/${service.slug}`;
  const ld = jsonLd({
    serviceName: service.name,
    serviceUrl: service.url,
    canonicalUrl,
    answer,
  });

  return (
    <section className="prose dark:prose-invert mb-12 max-w-none">
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD requires literal JSON
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(ld).replace(/</g, "\\u003c"),
        }}
      />
      <h1>Is {service.name} down?</h1>
      <p>
        {answer} Below you'll find the live {service.name} status, uptime over the last{" "}
        {HISTORY_DAYS} days, and recent {service.name} incidents.
      </p>
      <div className="not-prose flex flex-wrap items-center gap-6">
        <ExternalServicePill indicator={indicator} status={status} statusMessage={statusMessage} />
        {fetchedAt > 0 ? (
          <span className="text-muted-foreground text-sm">
            Last updated {formatRelative(fetchedAt)}
            {stale ? (
              <span className="ml-1 inline-flex px-2 py-0.5 text-warning text-xs">(stale)</span>
            ) : null}
          </span>
        ) : (
          <span className="text-muted-foreground text-sm">
            No data yet — tracking begins after first poll.
          </span>
        )}
        <a
          className="text-sm underline"
          href={service.statusPageUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          Upstream status page
        </a>
      </div>

      <h2>
        {service.name} uptime — last {HISTORY_DAYS} days
      </h2>
      <div className="not-prose">
        <HistoryBars daily={historyRows} days={HISTORY_DAYS} />
      </div>

      <h2>{service.name} recent incidents</h2>
      <Suspense
        fallback={<p className="text-muted-foreground">Loading recent {service.name} incidents…</p>}
      >
        <Incidents
          statusPageUrl={service.statusPageUrl}
          serviceName={service.name}
          apiConfigType={service.apiConfig?.type}
        />
      </Suspense>
    </section>
  );
}
