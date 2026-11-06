"use client";

import { cn } from "@openstatus/ui/lib/utils";
import Link from "next/link";

import { JsonLd } from "../../../../../lib/metadata/json-ld";
import { BASE_URL } from "../../../../../lib/metadata/shared-metadata";
import {
  createJsonLDGraph,
  getJsonLDBreadcrumbList,
  getJsonLDFAQPage,
  getJsonLDWebPage,
} from "../../../../../lib/metadata/structured-data";
import { api } from "../../../../../trpc/rq-client";
import { ServiceStatusLabel } from "../../external-service-pill";
import { StatusSection, TILE_GRID } from "../../service-blocks";
import {
  getComponentFullName,
  getStatusAnswer,
  isFresh,
  isStale,
  problemRank,
  summarizeHistory,
} from "../../utils";
import { AnswerBox, AnswerLink } from "../answer-box";
import { HistoryBars } from "../history-bars";
import { IncidentRows } from "../incidents";
import { ReportIssue } from "../report-issue";

const SIBLINGS_SHOWN = 12;

function jsonLd(args: {
  serviceName: string;
  componentName: string;
  fullName: string;
  serviceUrl: string;
  componentUrl: string;
  answer: string;
}) {
  return createJsonLDGraph([
    getJsonLDWebPage({
      name: `${args.fullName} Status`,
      url: args.componentUrl,
    }),
    getJsonLDFAQPage([
      {
        question: `Is ${args.fullName} down?`,
        answer: args.answer,
      },
    ]),
    getJsonLDBreadcrumbList([
      { name: "External Status", url: `${BASE_URL}/status` },
      { name: args.serviceName, url: args.serviceUrl },
      { name: args.componentName, url: args.componentUrl },
    ]),
  ]);
}

function OtherComponents({
  serviceSlug,
  serviceName,
  currentSlug,
}: {
  serviceSlug: string;
  serviceName: string;
  currentSlug: string;
}) {
  // days:1 keeps history minimal; this sibling list only needs name and status.
  const [data] = api.externalService.components.useSuspenseQuery({
    slug: serviceSlug,
    days: 1,
  });
  const others = data.components
    .filter((c) => c.slug !== currentSlug)
    .sort((a, b) => problemRank(b) - problemRank(a) || a.position - b.position);
  if (others.length === 0) return null;

  return (
    <StatusSection
      id="siblings"
      title={`Other ${serviceName} components`}
      count={String(others.length)}
      aside={
        <Link
          href={`/status/${serviceSlug}#components`}
          className="text-foreground underline underline-offset-4"
        >
          All of {serviceName}
        </Link>
      }
    >
      <div
        className={cn(TILE_GRID, "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3")}
      >
        {others.slice(0, SIBLINGS_SHOWN).map((c) => (
          <Link
            key={c.slug}
            href={`/status/${serviceSlug}/${c.slug}`}
            className={cn(
              "hover:bg-muted! flex items-center justify-between gap-3 px-3 py-2 no-underline!",
              "transition-colors duration-150 motion-reduce:transition-none",
            )}
          >
            <span className="text-foreground truncate">{c.name}</span>
            <ServiceStatusLabel
              indicator={c.indicator}
              status={c.status}
              quietWhenOk
            />
          </Link>
        ))}
      </div>
    </StatusSection>
  );
}

export function ComponentDetail({
  serviceSlug,
  componentSlug,
  days,
  checker,
}: {
  serviceSlug: string;
  componentSlug: string;
  days: number;
  checker?: { href: string; host: string } | null;
}) {
  const [data] = api.externalService.component.useSuspenseQuery({
    serviceSlug,
    componentSlug,
    days,
  });

  if (!data.found || !data.service || !data.component) return null;
  const { service, component, history, incidents, overlayIncidents } = data;

  const fullName = getComponentFullName(service.name, component.name);
  // `component.stale` is the 24h hide-from-index window; "live" is STALE_THRESHOLD_MS (2h).
  const hasLiveData = isFresh(component.lastFetchedAt);
  const stale = component.lastFetchedAt > 0 && isStale(component.lastFetchedAt);
  const answer = getStatusAnswer({
    name: fullName,
    indicator: component.indicator,
    status: component.status,
    hasLiveData,
  });
  const summary = summarizeHistory(history);

  const serviceUrl = `${BASE_URL}/status/${service.slug}`;
  const componentUrl = `${serviceUrl}/${component.slug}`;
  const ld = jsonLd({
    serviceName: service.name,
    componentName: component.name,
    fullName,
    serviceUrl,
    componentUrl,
    answer,
  });

  return (
    <div className="flex flex-col gap-10">
      <JsonLd graph={ld} />

      <div className="flex flex-col gap-3">
        <div>
          <h1 className="mb-1!">Is {fullName} down?</h1>
          <p className="text-muted-foreground m-0! text-sm">
            Part of{" "}
            <Link href={`/status/${service.slug}`}>{service.name} status</Link>
            {component.groupName ? <> · {component.groupName}</> : null}
          </p>
        </div>
        <AnswerBox
          answer={answer}
          indicator={hasLiveData ? component.indicator : ""}
          status={hasLiveData ? component.status : ""}
          message={component.description ?? undefined}
          checkedAt={component.lastFetchedAt}
          stale={stale}
          reporters={component.reporters}
          links={
            <>
              <AnswerLink href={`/status/${service.slug}`}>
                All of {service.name}
              </AnswerLink>
              <AnswerLink href={service.statusPageUrl} external>
                Official status page
              </AnswerLink>
              {checker ? (
                <AnswerLink href={checker.href}>
                  Test {checker.host} from 28 regions
                </AnswerLink>
              ) : null}
            </>
          }
        />
        <ReportIssue
          slug={service.slug}
          name={fullName}
          componentSlug={component.slug}
        />
      </div>

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

      <StatusSection
        id="incidents"
        title={`Incidents affecting ${component.name}`}
        aside={
          <AnswerLink href={service.statusPageUrl} external>
            Full history
          </AnswerLink>
        }
      >
        {incidents.length === 0 ? (
          <p className="text-muted-foreground m-0">
            No incidents affecting {component.name} recently.
          </p>
        ) : (
          <IncidentRows
            incidents={incidents}
            statusPageUrl={service.statusPageUrl}
          />
        )}
      </StatusSection>

      <OtherComponents
        serviceSlug={service.slug}
        serviceName={service.name}
        currentSlug={component.slug}
      />
    </div>
  );
}
