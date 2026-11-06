"use client";

import { cn } from "@openstatus/ui/lib/utils";
import Link from "next/link";

import { api } from "../../../../trpc/rq-client";
import { ServiceStatusLabel } from "../external-service-pill";
import { StatusSection } from "../service-blocks";
import { formatRelative } from "../utils";

const ROW =
  "hover:bg-muted! grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-0.5 px-3 py-2 no-underline! transition-colors duration-150 motion-reduce:transition-none";
const SEVERITY: Record<string, number> = { minor: 1, major: 2, critical: 3 };
const AFFECTED_SHOWN = 8;

export function AffectedNow({
  slug,
  serviceName,
  statusPageUrl,
  days,
}: {
  slug: string;
  serviceName: string;
  statusPageUrl: string;
  days: number;
}) {
  const [components] = api.externalService.components.useSuspenseQuery({
    slug,
    days,
  });
  const [incidents] = api.externalService.incidents.useSuspenseQuery({ slug });

  const affected = components.components
    .filter(
      (c) =>
        (SEVERITY[c.indicator] ?? 0) > 0 || c.status === "under_maintenance",
    )
    .sort(
      (a, b) =>
        (SEVERITY[b.indicator] ?? 0) - (SEVERITY[a.indicator] ?? 0) ||
        a.position - b.position,
    );
  const active = incidents.incidents.filter((i) => !i.resolvedAt);

  if (affected.length === 0 && active.length === 0) return null;

  return (
    <StatusSection
      id="affected"
      title="What's affected right now"
      count={affected.length > 0 ? String(affected.length) : undefined}
    >
      {active.length > 0 ? (
        <div className="border-border bg-border [&>*]:bg-background grid grid-cols-1 gap-px border bg-clip-padding">
          {active.map((inc) => (
            <a
              key={inc.id}
              href={inc.shortlink ?? `${statusPageUrl}/incidents/${inc.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className={ROW}
            >
              <span className="text-foreground truncate font-medium">
                {inc.name}
              </span>
              <span className="text-warning text-xs capitalize">
                {inc.status.replaceAll("_", " ")}
              </span>
              <span className="text-muted-foreground col-span-2 text-sm">
                Open incident on {serviceName}&apos;s status page, started{" "}
                {formatRelative(Date.parse(inc.startedAt ?? inc.createdAt))}
              </span>
            </a>
          ))}
        </div>
      ) : null}
      {affected.length > 0 ? (
        <div className="border-border bg-border [&>*]:bg-background grid grid-cols-1 gap-px border bg-clip-padding">
          {affected.slice(0, AFFECTED_SHOWN).map((c) => (
            <Link
              key={c.id}
              href={`/status/${slug}/${c.slug}`}
              className={cn(ROW)}
            >
              <span className="truncate">
                {c.groupName ? (
                  <span className="text-muted-foreground hidden sm:inline">
                    {c.groupName} /{" "}
                  </span>
                ) : null}
                <span className="text-foreground font-medium">{c.name}</span>
              </span>
              <ServiceStatusLabel indicator={c.indicator} status={c.status} />
            </Link>
          ))}
        </div>
      ) : null}
      {affected.length > AFFECTED_SHOWN ? (
        <a
          href="#components"
          className="text-muted-foreground hover:text-foreground m-0 text-sm underline underline-offset-4"
        >
          and {affected.length - AFFECTED_SHOWN} more, see all components
        </a>
      ) : null}
    </StatusSection>
  );
}
