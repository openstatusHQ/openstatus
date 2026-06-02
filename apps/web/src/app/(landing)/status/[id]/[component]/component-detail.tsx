"use client";

import { ExternalServicePill } from "@openstatus/ui/components/blocks/external-service-pill";

import {
  ContentBoxDescription,
  ContentBoxLink,
  ContentBoxTitle,
} from "@/app/(landing)/content-box";
import { Grid } from "@/content/mdx-components/grid";
import { BASE_URL } from "@/lib/metadata/shared-metadata";
import { api } from "@/trpc/rq-client";

import { formatRelative } from "../../utils";
import { HistoryBars } from "../history-bars";

function answerFor(args: {
  fullName: string;
  indicator: string;
  status: string;
  stale: boolean;
}): string {
  const { fullName, indicator, status, stale } = args;
  if (stale) {
    return `We don't have live data for ${fullName} right now — check the official status page below.`;
  }
  if (status === "under_maintenance") {
    return `${fullName} is currently undergoing scheduled maintenance.`;
  }
  switch (indicator) {
    case "none":
      return `No, ${fullName} is not down. It is operational.`;
    case "minor":
      return `${fullName} is up, but currently experiencing a minor issue.`;
    case "major":
      return `Yes, ${fullName} is experiencing a partial outage right now.`;
    case "critical":
      return `Yes, ${fullName} is down — a major outage is currently affecting it.`;
    default:
      return `The current status of ${fullName} is unknown — check the official status page below.`;
  }
}

function impactClass(impact: string | undefined): string {
  switch (impact) {
    case "critical":
      return "bg-destructive/20 text-destructive border-destructive/30";
    case "major":
      return "bg-destructive/15 text-destructive border-destructive/20";
    case "minor":
      return "bg-warning/15 text-warning border-warning/30";
    case "maintenance":
      return "bg-info/15 text-info border-info/30";
    default:
      return "bg-muted text-muted-foreground border-muted-foreground/20";
  }
}

function formatTimestamp(value: string | null | undefined): string | null {
  if (!value) return null;
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) return null;
  return new Date(ms).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function jsonLd(args: {
  serviceName: string;
  componentName: string;
  serviceUrl: string;
  componentUrl: string;
  answer: string;
}) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        url: args.componentUrl,
        name: `${args.serviceName} ${args.componentName} Status`,
      },
      {
        "@type": "FAQPage",
        mainEntity: [
          {
            "@type": "Question",
            name: `Is ${args.serviceName} ${args.componentName} down?`,
            acceptedAnswer: { "@type": "Answer", text: args.answer },
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
            item: args.serviceUrl,
          },
          {
            "@type": "ListItem",
            position: 3,
            name: args.componentName,
            item: args.componentUrl,
          },
        ],
      },
    ],
  };
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
  const { data } = api.externalService.components.useQuery({ slug: serviceSlug });
  const others =
    data?.components.filter((c) => c.slug !== currentSlug).slice(0, 12) ?? [];
  if (others.length === 0) return null;

  return (
    <>
      <h2>Other {serviceName} components</h2>
      <div className="not-prose flex flex-wrap gap-2">
        {others.map((c) => (
          <a
            key={c.slug}
            href={`/status/${serviceSlug}/${c.slug}`}
            className="inline-flex rounded-none border px-2.5 py-0.5 text-sm hover:bg-muted"
          >
            {c.name}
          </a>
        ))}
      </div>
    </>
  );
}

export function ComponentDetail({
  serviceSlug,
  componentSlug,
  days,
}: {
  serviceSlug: string;
  componentSlug: string;
  days: number;
}) {
  const [data] = api.externalService.component.useSuspenseQuery({
    serviceSlug,
    componentSlug,
    days,
  });

  if (!data.found || !data.service || !data.component) return null;
  const { service, component, history, incidents } = data;

  const fullName = `${service.name} ${component.name}`;
  const answer = answerFor({
    fullName,
    indicator: component.indicator,
    status: component.status,
    stale: component.stale,
  });

  const serviceUrl = `${BASE_URL}/status/${service.slug}`;
  const componentUrl = `${serviceUrl}/${component.slug}`;
  const ld = jsonLd({
    serviceName: service.name,
    componentName: component.name,
    serviceUrl,
    componentUrl,
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

      <nav className="not-prose mb-4 text-muted-foreground text-sm">
        <a className="hover:underline" href="/status">
          External Status
        </a>
        {" / "}
        <a className="hover:underline" href={`/status/${service.slug}`}>
          {service.name}
        </a>
        {" / "}
        <span className="text-foreground">{component.name}</span>
      </nav>

      <h1>
        Is {service.name} {component.name} down?
      </h1>
      <p>
        {answer} Below you'll find the live {component.name} status, uptime over
        the last {days} days, and recent incidents affecting {component.name}.
      </p>

      <div className="not-prose flex flex-wrap items-center gap-6">
        <ExternalServicePill
          indicator={component.indicator}
          status={component.status}
          statusMessage={component.description ?? undefined}
        />
        {component.lastSeenAt > 0 ? (
          <span className="text-muted-foreground text-sm">
            Last updated {formatRelative(component.lastSeenAt)}
            {component.stale ? (
              <span className="ml-1 inline-flex px-2 py-0.5 text-warning text-xs">
                (stale)
              </span>
            ) : null}
          </span>
        ) : null}
        <a className="text-sm underline" href={`/status/${service.slug}`}>
          ← {service.name} status
        </a>
        <a
          className="text-sm underline"
          href={service.statusPageUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          Upstream status page
        </a>
      </div>

      {component.description ? <p>{component.description}</p> : null}

      <h2>
        {component.name} uptime — last {days} days
      </h2>
      <div className="not-prose">
        <HistoryBars daily={history} days={days} />
      </div>

      <h2>{component.name} recent incidents</h2>
      {incidents.length === 0 ? (
        <p className="text-muted-foreground">
          No incidents affecting {component.name} in the recent period.
        </p>
      ) : (
        <Grid cols={1} className="not-prose">
          {incidents.map((inc) => {
            const started = formatTimestamp(inc.startedAt ?? inc.createdAt);
            const resolved = formatTimestamp(inc.resolvedAt ?? null);
            const link =
              inc.shortlink ?? `${service.statusPageUrl}/incidents/${inc.id}`;
            return (
              <ContentBoxLink
                key={inc.id}
                href={link}
                className="flex flex-col gap-1"
              >
                <div className="flex items-center justify-between gap-3">
                  <ContentBoxTitle className="m-0!">{inc.name}</ContentBoxTitle>
                  <span
                    className={`inline-flex items-center rounded-none border px-2.5 py-0.5 font-medium text-xs ${impactClass(inc.impact)}`}
                  >
                    {inc.impact === "none" ? "incident" : (inc.impact ?? "incident")}
                  </span>
                </div>
                <ContentBoxDescription className="m-0! text-sm">
                  {started ? <>Started {started}</> : null}
                  {started && resolved ? " · " : null}
                  {resolved ? <>Resolved {resolved}</> : null}
                </ContentBoxDescription>
              </ContentBoxLink>
            );
          })}
        </Grid>
      )}

      <OtherComponents
        serviceSlug={service.slug}
        serviceName={service.name}
        currentSlug={component.slug}
      />
    </section>
  );
}
