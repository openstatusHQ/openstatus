"use client";

import { useStatusPage } from "@/components/status-page/floating-button";
import {
  Status,
  StatusBanner,
  StatusContent,
  StatusDescription,
  StatusEmptyState,
  StatusEmptyStateDescription,
  StatusEmptyStateTitle,
  StatusHeader,
  StatusTitle,
} from "@/components/status-page/status";
import { StatusMonitor } from "@/components/status-page/status-monitor";
import { getHighestStatus } from "@/components/status-page/utils";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { Newspaper } from "lucide-react";
import { useParams } from "next/navigation";

export default function Page() {
  const { domain } = useParams<{ domain: string }>();
  const trpc = useTRPC();
  const { data: page } = useQuery(
    trpc.statusPage.get.queryOptions({ slug: domain }),
  );
  const { data: uptime } = useQuery(
    trpc.statusPage.getUptime.queryOptions({
      slug: domain,
      monitorIds: page?.monitors?.map((monitor) => monitor.id.toString()) || [],
    }),
  );
  const { cardType, barType, showUptime } = useStatusPage();

  if (!page) return null;

  return (
    <div className="flex flex-col gap-6">
      <Status
        variant={getHighestStatus(
          page.monitors.map((monitor) => monitor.status),
        )}
      >
        <StatusHeader>
          <StatusTitle>{page.title}</StatusTitle>
          <StatusDescription>{page.description}</StatusDescription>
        </StatusHeader>
        <StatusBanner />
        <StatusContent>
          {page.monitors.map((monitor) => {
            return (
              <StatusMonitor
                key={monitor.id}
                variant={monitor.status}
                cardType={cardType}
                barType={barType}
                data={
                  uptime
                    ?.find((m) => m.id === monitor.id)
                    ?.data.map((item) => ({
                      ...item,
                      success: item.ok,
                      info: 0,
                      timestamp: new Date(item.day).getTime(),
                    })) || []
                }
                monitor={monitor}
                showUptime={showUptime}
                events={monitor.events ?? []}
              />
            );
          })}
        </StatusContent>
        <StatusContent>
          <StatusEmptyState>
            <Newspaper className="size-4 text-muted-foreground" />
            <StatusEmptyStateTitle>No recent reports</StatusEmptyStateTitle>
            <StatusEmptyStateDescription>
              There have been no reports within the last 7 days.
            </StatusEmptyStateDescription>
          </StatusEmptyState>
        </StatusContent>
      </Status>
    </div>
  );
}
