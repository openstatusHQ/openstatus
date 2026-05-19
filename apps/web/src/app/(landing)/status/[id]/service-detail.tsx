"use client";

import { Suspense } from "react";

import { BASE_URL } from "@/lib/metadata/shared-metadata";
import { api } from "@/trpc/rq-client";

import { ExternalServicePill } from "../external-service-pill";
import { formatRelative, getStatusAnswer, isStale } from "../utils";
import { HistoryBars } from "./history-bars";
import { Incidents } from "./incidents";

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

export function ServiceDetail({ slug, days }: { slug: string; days: number }) {
  const [data] = api.externalService.detail.useSuspenseQuery({ slug, days });
  const { service, latest, history } = data;

  const indicator = latest?.indicator ?? "";
  const status = latest?.status ?? "";
  const statusMessage = latest?.statusMessage || undefined;
  const fetchedAt = latest?.lastFetchedAt ?? 0;
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
        {answer} Below you'll find the live {service.name} status, uptime over
        the last {days} days, and recent {service.name} incidents.
      </p>
      <div className="not-prose flex flex-wrap items-center gap-6">
        <ExternalServicePill
          indicator={indicator}
          status={status}
          statusMessage={statusMessage}
        />
        {fetchedAt > 0 ? (
          <span className="text-muted-foreground text-sm">
            Last updated {formatRelative(fetchedAt)}
            {stale ? (
              <span className="ml-1 inline-flex px-2 py-0.5 text-warning text-xs">
                (stale)
              </span>
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
        {service.name} uptime — last {days} days
      </h2>
      <div className="not-prose">
        <HistoryBars daily={history} days={days} />
      </div>

      <h2>{service.name} recent incidents</h2>
      <Suspense
        fallback={
          <p className="text-muted-foreground">
            Loading recent {service.name} incidents…
          </p>
        }
      >
        <Incidents
          slug={service.slug}
          serviceName={service.name}
          statusPageUrl={service.statusPageUrl}
        />
      </Suspense>
    </section>
  );
}
