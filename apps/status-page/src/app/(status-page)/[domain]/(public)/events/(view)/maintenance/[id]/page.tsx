"use client";

import { useTRPC } from "@/lib/trpc/client";
import { useQuery } from "@tanstack/react-query";

import { formatDate } from "@/lib/formatter";

import { ButtonBack } from "@/components/button/button-back";
import { ButtonCopyLink } from "@/components/button/button-copy-link";
import {
  StatusEvent,
  StatusEventAffected,
  StatusEventAffectedBadge,
  StatusEventAside,
  StatusEventContent,
  StatusEventTimelineMaintenance,
  StatusEventTitle,
} from "@/components/status-page/status-events";
import { useParams } from "next/navigation";

export default function MaintenancePage() {
  const trpc = useTRPC();
  const { id, domain } = useParams<{ id: string; domain: string }>();
  const { data: maintenance } = useQuery(
    trpc.statusPage.getMaintenance.queryOptions({
      id: Number(id),
      slug: domain,
    }),
  );

  if (!maintenance) return null;

  const isFuture = maintenance.from > new Date();
  return (
    <div className="flex flex-col gap-4">
      <div className="flex w-full flex-row items-center justify-between gap-2 py-0.5">
        <ButtonBack href="../" />
        <ButtonCopyLink />
      </div>
      <StatusEvent>
        <StatusEventAside>
          <span className="font-medium text-foreground/80">
            {formatDate(maintenance.from, { month: "short" })}
          </span>
          {isFuture ? (
            <span className="text-info text-sm">Upcoming</span>
          ) : null}
        </StatusEventAside>
        <StatusEventContent hoverable={false}>
          <StatusEventTitle>{maintenance.title}</StatusEventTitle>
          <StatusEventAffected>
            {maintenance.maintenancesToMonitors.map((affected) => (
              <StatusEventAffectedBadge key={affected.monitor.id}>
                {affected.monitor.name}
              </StatusEventAffectedBadge>
            ))}
          </StatusEventAffected>
          <StatusEventTimelineMaintenance maintenance={maintenance} />
        </StatusEventContent>
      </StatusEvent>
    </div>
  );
}
