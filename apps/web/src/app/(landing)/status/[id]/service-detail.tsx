"use client";

import { REPORT_WINDOW_MINUTES } from "@openstatus/api/src/router/effective-status";
import { cn } from "@openstatus/ui/lib/utils";
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
import { getPillStyle } from "../external-service-pill";
import { StatusSection } from "../service-blocks";
import {
  formatRelative,
  getCheckerHref,
  getHost,
  getStatusAnswer,
  isStale,
  summarizeHistory,
} from "../utils";
import { AffectedNow } from "./affected-now";
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
  const pill = getPillStyle({
    indicator: hasLiveData ? effective.indicator : "",
    status: effective.status,
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
        <div
          className={cn("not-prose flex flex-col gap-2 border p-3", pill.box)}
        >
          <p className="text-foreground m-0 flex items-start gap-2 font-semibold">
            <span
              aria-hidden="true"
              className={cn("mt-[0.45em] size-2.5 shrink-0", pill.dot)}
            />
            {answer}
          </p>
          {showMessage ? (
            <p className="text-foreground/80 m-0">
              {service.name} says: {message}
            </p>
          ) : null}
          <p className="text-muted-foreground m-0 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <span>
              {fetchedAt > 0
                ? `Checked ${formatRelative(fetchedAt)}`
                : "Not checked yet"}
              {stale ? <span className="text-warning"> (stale)</span> : null}
            </span>
            <span className="tabular-nums">
              {reports.reporters}{" "}
              {reports.reporters === 1 ? "user report" : "user reports"} in{" "}
              {REPORT_WINDOW_MINUTES} min
            </span>
            <a
              className="text-foreground underline underline-offset-4"
              href={service.statusPageUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Official status page ↗
            </a>
            {checkerHref ? (
              <a
                className="text-foreground underline underline-offset-4"
                href={checkerHref}
              >
                Test {getHost(service.url)} from 28 regions →
              </a>
            ) : null}
          </p>
        </div>
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
