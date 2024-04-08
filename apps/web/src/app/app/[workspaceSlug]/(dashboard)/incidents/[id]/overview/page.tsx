import Image from "next/image";
import Link from "next/link";
import { formatDistanceStrict } from "date-fns";
import { ArrowUpRight } from "lucide-react";

import { api } from "@/trpc/server";
import { Event } from "./_components/event";

/**
 * MetricCards (Like: Duration, Monitor Name, Autoresolved,...)
 *
 * Start Date + (can we include the response details?)
 * Screenshot
 * Acknowledged
 * Resolved
 *
 */

export default async function IncidentPage({
  params,
}: {
  params: { workspaceSlug: string; id: string };
}) {
  const incident = await api.incident.getIncidentById.query({
    id: Number(params.id),
  });

  const duration = formatDistanceStrict(
    new Date(incident.startedAt),
    incident?.resolvedAt ? new Date(incident.resolvedAt) : new Date(),
  );

  return (
    <div className="grid gap-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 md:gap-6">
        <div className="flex flex-col gap-2 rounded-lg border px-3 py-2">
          <p className="text-muted-foreground text-sm font-light uppercase">
            Monitor
          </p>
          <div className="flex flex-row items-end gap-2">
            <p className="text-xl font-semibold">{incident.monitorName}</p>
            <Link
              href={`/app/${params.workspaceSlug}/monitors/${incident.monitorId}/overview`}
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowUpRight />
            </Link>
          </div>
        </div>
        <div className="flex flex-col gap-2 rounded-lg border px-3 py-2">
          <p className="text-muted-foreground text-sm font-light uppercase">
            Duration
          </p>
          <p className="text-xl font-semibold">{duration}</p>
        </div>
        <div className="flex flex-col gap-2 rounded-lg border px-3 py-2">
          <p className="text-muted-foreground text-sm font-light uppercase">
            Auto-resolved
          </p>
          <p className="font-mono text-xl font-semibold">
            {incident.autoResolved ? "true" : "false"}
          </p>
        </div>
      </div>
      <div className="max-w-xl">
        <Event label="Started" icon="alert-triangle" date={incident.startedAt}>
          {incident.incidentScreenshotUrl ? (
            <div className="border-border bg-background relative h-64 w-full overflow-hidden rounded-xl border">
              <a
                href={incident.incidentScreenshotUrl}
                target="_blank"
                rel="noreferrer"
              >
                <Image
                  src={incident.incidentScreenshotUrl}
                  fill={true}
                  alt="incident screenshot"
                  className="object-contain"
                />
              </a>
            </div>
          ) : null}
        </Event>
        {incident?.acknowledgedAt ? (
          <Event
            label="Acknowledged"
            icon="eye"
            date={incident.acknowledgedAt}
          />
        ) : null}
        {incident?.resolvedAt ? (
          <Event label="Resolved" icon="check" date={incident.resolvedAt}>
            {incident.recoveryScreenshotUrl ? (
              <div className="border-border bg-background relative h-64 w-full overflow-hidden rounded-xl border">
                <a
                  href={incident.recoveryScreenshotUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Image
                    src={incident.recoveryScreenshotUrl}
                    fill={true}
                    alt="recovery screenshot"
                    className="object-contain"
                  />
                </a>
              </div>
            ) : null}
          </Event>
        ) : null}
      </div>
    </div>
  );
}
