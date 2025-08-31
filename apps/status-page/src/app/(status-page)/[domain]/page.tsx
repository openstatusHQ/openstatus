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
import { StatusTrackerGroup } from "@/components/status-page/status-tracker-group";
import { chartData } from "@/components/status-page/utils";
import { monitors } from "@/data/monitors";
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
  const { variant, cardType, barType, showUptime } = useStatusPage();

  if (!page) return null;

  return (
    <div className="flex flex-col gap-6">
      <Status variant={variant}>
        <StatusHeader>
          <StatusTitle>{page.title}</StatusTitle>
          <StatusDescription>{page.description}</StatusDescription>
        </StatusHeader>
        <StatusBanner />
        <StatusContent>
          <StatusMonitor
            variant={variant}
            cardType={cardType}
            barType={barType}
            data={chartData}
            monitor={monitors[1]}
            showUptime={showUptime}
          />
          <StatusTrackerGroup title="US Endpoints" variant={variant}>
            <StatusMonitor
              variant={variant}
              cardType={cardType}
              barType={barType}
              data={chartData}
              monitor={monitors[0]}
              showUptime={showUptime}
            />
            <StatusMonitor
              variant={variant}
              cardType={cardType}
              barType={barType}
              data={chartData}
              monitor={monitors[1]}
              showUptime={showUptime}
            />
          </StatusTrackerGroup>
          <StatusTrackerGroup title="EU Endpoints" variant={variant}>
            <StatusMonitor
              variant={variant}
              cardType={cardType}
              barType={barType}
              data={chartData}
              monitor={monitors[0]}
              showUptime={showUptime}
            />
            <StatusMonitor
              variant={variant}
              cardType={cardType}
              barType={barType}
              data={chartData}
              monitor={monitors[1]}
              showUptime={showUptime}
            />
          </StatusTrackerGroup>
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
