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
import { StatusSection } from "../service-blocks";
import {
  getCheckerHref,
  getHost,
  getStatusAnswer,
  isStale,
  summarizeHistory,
} from "../utils";
import { AffectedNow } from "./affected-now";
import { AnswerBox, AnswerLink } from "./answer-box";
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

const GENERIC_MESSAGES = new Set([
  "",
  "all systems operational",
  "status unavailable",
]);

export function ServiceDetail({ slug, days }: { slug: string; days: number }) {
  const [data] = api.externalService.detail.useSuspenseQuery({ slug, days });
  const { service, latest, history, effective, overlayIncidents, reports } =
    data;

  const fetchedAt = latest?.lastFetchedAt ?? 0;
  const stale = fetchedAt > 0 && isStale(fetchedAt);
  const hasLiveData = fetchedAt > 0 && !stale;
  const answer = getStatusAnswer({
    name: service.name,
    indicator: effective.indicator,
    status: effective.status,
    hasLiveData,
  });
  const message = latest?.statusMessage ?? "";
  const showMessage = !GENERIC_MESSAGES.has(message.trim().toLowerCase());
  const checkerHref = getCheckerHref(service.url);
  const summary = summarizeHistory(history);

  const canonicalUrl = `${BASE_URL}/status/${service.slug}`;
  const ld = jsonLd({
    serviceName: service.name,
    serviceUrl: service.url,
    canonicalUrl,
    answer,
  });

  return (
    <div className="flex flex-col gap-10">
      <JsonLd graph={ld} />

      <div className="flex flex-col gap-3">
        <h1 className="m-0!">Is {service.name} down?</h1>
        <AnswerBox
          answer={answer}
          indicator={hasLiveData ? effective.indicator : ""}
          status={hasLiveData ? effective.status : ""}
          message={showMessage ? `${service.name} says: ${message}` : undefined}
          checkedAt={fetchedAt}
          stale={stale}
          reporters={reports.reporters}
          links={
            <>
              <AnswerLink href={service.statusPageUrl} external>
                Official status page ↗
              </AnswerLink>
              {checkerHref ? (
                <AnswerLink href={checkerHref}>
                  Test {getHost(service.url)} from 28 regions →
                </AnswerLink>
              ) : null}
            </>
          }
        />
        <ReportIssue
          slug={service.slug}
          name={service.name}
          days={days}
          allowComponentSelect
        />
      </div>

      <Suspense fallback={null}>
        <AffectedNow
          slug={service.slug}
          serviceName={service.name}
          statusPageUrl={service.statusPageUrl}
          days={days}
        />
      </Suspense>

      <StatusSection
        id="history"
        title={`Last ${days} days`}
        aside={
          summary.tracked > 0
            ? `${summary.tracked - summary.issueDays} of ${summary.tracked} tracked days without issues`
            : "No history yet"
        }
      >
        <HistoryBars daily={history} days={days} incidents={overlayIncidents} />
      </StatusSection>

      <Suspense fallback={null}>
        <UserReports
          slug={service.slug}
          serviceName={service.name}
          days={days}
        />
      </Suspense>

      <Suspense fallback={null}>
        <ServiceComponents
          slug={service.slug}
          serviceName={service.name}
          days={days}
        />
      </Suspense>

      <Suspense
        fallback={
          <p className="text-muted-foreground m-0!">
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
    </div>
  );
}
