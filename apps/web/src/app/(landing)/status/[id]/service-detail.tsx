"use client";

import { Suspense } from "react";

import { JsonLd } from "../../../../lib/metadata/json-ld";
import { BASE_URL } from "../../../../lib/metadata/shared-metadata";
import {
  createJsonLDGraph,
  getJsonLDBreadcrumbList,
  getJsonLDFAQPage,
  getJsonLDService,
  getJsonLDWebPage,
} from "../../../../lib/metadata/structured-data";
import { api } from "../../../../trpc/rq-client";
import { ExternalServicePill } from "../external-service-pill";
import { formatRelative, getStatusAnswer, isStale } from "../utils";
import { HistoryBars } from "./history-bars";
import { Incidents } from "./incidents";
import { ReportIssue } from "./report-issue";
import { ServiceComponents } from "./service-components";
import { UserReports } from "./user-reports";

function jsonLd(args: {
  serviceName: string;
  serviceUrl: string;
  canonicalUrl: string;
  answer: string;
}) {
  return createJsonLDGraph([
    getJsonLDService({ name: args.serviceName, url: args.serviceUrl }),
    getJsonLDWebPage({
      name: `${args.serviceName} Status`,
      url: args.canonicalUrl,
    }),
    getJsonLDFAQPage([
      { question: `Is ${args.serviceName} down?`, answer: args.answer },
    ]),
    getJsonLDBreadcrumbList([
      { name: "External Status", url: `${BASE_URL}/status` },
      { name: args.serviceName, url: args.canonicalUrl },
    ]),
  ]);
}

export function ServiceDetail({ slug, days }: { slug: string; days: number }) {
  const [data] = api.externalService.detail.useSuspenseQuery({ slug, days });
  const { service, latest, history, effective, overlayIncidents } = data;

  const indicator = effective.indicator;
  const status = effective.status;
  const escalated = effective.escalated;
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
      <JsonLd graph={ld} />
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
          escalated={escalated}
        />
        {fetchedAt > 0 ? (
          <span className="text-muted-foreground text-sm">
            Last updated {formatRelative(fetchedAt)}
            {stale ? (
              <span className="text-warning ml-1 inline-flex px-2 py-0.5 text-xs">
                (stale)
              </span>
            ) : null}
          </span>
        ) : (
          <span className="text-muted-foreground text-sm">
            No data yet. Tracking begins after the first poll.
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

      <div className="not-prose mt-6">
        <ReportIssue
          slug={service.slug}
          name={service.name}
          days={days}
          allowComponentSelect
        />
      </div>

      <Suspense fallback={null}>
        <UserReports
          slug={service.slug}
          serviceName={service.name}
          days={days}
        />
      </Suspense>

      <h2>
        {service.name} uptime over the last {days} days
      </h2>
      <div className="not-prose">
        <HistoryBars daily={history} days={days} incidents={overlayIncidents} />
      </div>

      <Suspense fallback={null}>
        <ServiceComponents
          slug={service.slug}
          serviceName={service.name}
          days={days}
        />
      </Suspense>

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
