"use client";

import { cn } from "@openstatus/ui/lib/utils";

import { api } from "../../../../trpc/rq-client";
import { StatusSection } from "../service-blocks";
import { formatDuration } from "../utils";

function impactText(impact: string | undefined): string {
  switch (impact) {
    case "critical":
    case "major":
      return "text-destructive";
    case "minor":
      return "text-warning";
    case "maintenance":
      return "text-info";
    default:
      return "text-muted-foreground";
  }
}

function shortDate(value: string): string {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export type IncidentsProps = {
  slug: string;
  serviceName: string;
  statusPageUrl: string;
};

export function Incidents({
  slug,
  serviceName,
  statusPageUrl,
}: IncidentsProps) {
  const [data] = api.externalService.incidents.useSuspenseQuery({ slug });

  return (
    <StatusSection
      id="incidents"
      title="Recent incidents"
      aside={
        <a
          className="text-foreground underline underline-offset-4"
          href={statusPageUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          Full history ↗
        </a>
      }
    >
      {!data.supported ? (
        <p className="text-muted-foreground m-0">
          {serviceName}&apos;s incident history isn&apos;t available here. Check
          the official status page for past incidents.
        </p>
      ) : data.incidents.length === 0 ? (
        <p className="text-muted-foreground m-0">
          No {serviceName} incidents reported recently.
        </p>
      ) : (
        <div className="border-border bg-border [&>*]:bg-background grid grid-cols-1 gap-px border bg-clip-padding">
          {data.incidents.map((inc) => {
            const started = inc.startedAt ?? inc.createdAt;
            const duration = inc.resolvedAt
              ? formatDuration(Date.parse(inc.resolvedAt) - Date.parse(started))
              : "ongoing";
            return (
              <a
                key={inc.id}
                href={inc.shortlink ?? `${statusPageUrl}/incidents/${inc.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:bg-muted! grid grid-cols-[4.5rem_minmax(0,1fr)_auto] items-center gap-x-4 px-3 py-2 no-underline! transition-colors duration-150 motion-reduce:transition-none sm:grid-cols-[4.5rem_minmax(0,1fr)_6rem_5rem]"
              >
                <span className="text-muted-foreground text-sm tabular-nums">
                  {shortDate(started)}
                </span>
                <span className="text-foreground truncate">{inc.name}</span>
                <span
                  className={cn(
                    "hidden text-xs sm:inline",
                    impactText(inc.impact),
                  )}
                >
                  {inc.impact && inc.impact !== "none"
                    ? inc.impact
                    : "incident"}
                </span>
                <span
                  className={cn(
                    "text-right text-xs tabular-nums",
                    inc.resolvedAt ? "text-muted-foreground" : "text-warning",
                  )}
                >
                  {duration}
                </span>
              </a>
            );
          })}
        </div>
      )}
    </StatusSection>
  );
}
