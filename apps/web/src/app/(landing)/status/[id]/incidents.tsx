"use client";

import { Grid } from "../../../../content/mdx-components/grid";
import { api } from "../../../../trpc/rq-client";
import {
  ContentBoxDescription,
  ContentBoxLink,
  ContentBoxTitle,
} from "../../content-box";

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

export type IncidentsProps = {
  slug: string;
  serviceName: string;
  statusPageUrl: string;
};

function UpstreamFallback({
  serviceName,
  statusPageUrl,
}: {
  serviceName: string;
  statusPageUrl: string;
}) {
  return (
    <p className="text-muted-foreground">
      Recent {serviceName} incident history isn't available here. Check the{" "}
      <a
        className="underline"
        href={statusPageUrl}
        target="_blank"
        rel="noopener noreferrer"
      >
        official {serviceName} status page
      </a>{" "}
      for the latest {serviceName} incidents.
    </p>
  );
}

export function Incidents({
  slug,
  serviceName,
  statusPageUrl,
}: IncidentsProps) {
  const [data] = api.externalService.incidents.useSuspenseQuery({ slug });

  if (!data.supported) {
    return (
      <UpstreamFallback
        serviceName={serviceName}
        statusPageUrl={statusPageUrl}
      />
    );
  }

  if (data.incidents.length === 0) {
    return (
      <p className="text-muted-foreground">
        No {serviceName} incidents reported in the recent period.
      </p>
    );
  }

  return (
    <Grid cols={1} className="not-prose">
      {data.incidents.map((inc) => {
        const started = formatTimestamp(inc.startedAt ?? inc.createdAt);
        const resolved = formatTimestamp(inc.resolvedAt ?? null);
        const link = inc.shortlink ?? `${statusPageUrl}/incidents/${inc.id}`;
        return (
          <ContentBoxLink
            key={inc.id}
            href={link}
            className="flex flex-col gap-1"
          >
            <div className="flex items-center justify-between gap-3">
              <ContentBoxTitle className="m-0!">{inc.name}</ContentBoxTitle>
              <span
                className={`inline-flex items-center rounded-none border px-2.5 py-0.5 text-xs font-medium ${impactClass(inc.impact)}`}
              >
                {inc.impact === "none"
                  ? "incident"
                  : (inc.impact ?? "incident")}
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
  );
}
