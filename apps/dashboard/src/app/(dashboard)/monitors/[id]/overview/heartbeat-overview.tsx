"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@openstatus/ui/components/ui/tooltip";
import { cn } from "@openstatus/ui/lib/utils";
import { heartbeatExpectation } from "@openstatus/utils";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow, startOfDay, subDays } from "date-fns";

import {
  EmptyStateContainer,
  EmptyStateDescription,
  EmptyStateTitle,
} from "@/components/content/empty-state";
import {
  Section,
  SectionDescription,
  SectionGroup,
  SectionHeader,
  SectionTitle,
} from "@/components/content/section";
import { AuditLogsWrapper } from "@/components/data-table/audit-logs/wrapper";
import { HeartbeatPingUrl } from "@/components/forms/monitor/form-heartbeat";
import {
  MetricCard,
  MetricCardGroup,
  MetricCardHeader,
  MetricCardTitle,
  MetricCardValue,
} from "@/components/metric/metric-card";
import { useTRPC } from "@/lib/trpc/client";

const DAYS = 30;

function relative(date: Date | null) {
  return date ? formatDistanceToNow(date, { addSuffix: true }) : "Never";
}

function PingBars({ days }: { days: { day: string; count: number }[] }) {
  const counts = new Map(
    days.map((d) => [startOfDay(new Date(d.day)).getTime(), d.count]),
  );
  const today = startOfDay(new Date());
  const range = Array.from({ length: DAYS }, (_, i) =>
    subDays(today, DAYS - 1 - i),
  );

  return (
    <div className="flex h-10 gap-0.5">
      {range.map((day) => {
        const count = counts.get(day.getTime()) ?? 0;
        return (
          <Tooltip key={day.getTime()}>
            <TooltipTrigger asChild>
              <div
                className={cn(
                  "flex-1 rounded-sm",
                  count > 0 ? "bg-success" : "bg-muted",
                )}
              />
            </TooltipTrigger>
            <TooltipContent>
              {day.toLocaleDateString()}: {count} ping{count === 1 ? "" : "s"}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

export function HeartbeatOverview({ id }: { id: number }) {
  const trpc = useTRPC();
  const { data: monitor } = useQuery(trpc.monitor.get.queryOptions({ id }));
  const { data: heartbeat } = useQuery(
    trpc.monitor.heartbeat.queryOptions({ id }),
  );
  const { data: days } = useQuery(
    trpc.monitor.heartbeatStatus.queryOptions({ id }),
  );

  if (!monitor || !heartbeat) return null;

  const waiting = heartbeat.lastPingAt === null;
  const down = monitor.status === "error";

  return (
    <SectionGroup>
      <Section>
        <SectionHeader>
          <SectionTitle>{monitor.name}</SectionTitle>
          <SectionDescription>
            Heartbeat · {heartbeatExpectation(monitor)}
          </SectionDescription>
        </SectionHeader>
        <MetricCardGroup>
          <MetricCard
            variant={
              !monitor.active || waiting
                ? "default"
                : down
                  ? "destructive"
                  : "success"
            }
          >
            <MetricCardHeader>
              <MetricCardTitle>Status</MetricCardTitle>
            </MetricCardHeader>
            <MetricCardValue>
              {!monitor.active
                ? "Paused"
                : waiting
                  ? "Waiting"
                  : down
                    ? "Missed"
                    : "On time"}
            </MetricCardValue>
          </MetricCard>
          <MetricCard>
            <MetricCardHeader>
              <MetricCardTitle>Last ping</MetricCardTitle>
            </MetricCardHeader>
            <MetricCardValue>{relative(heartbeat.lastPingAt)}</MetricCardValue>
          </MetricCard>
          <MetricCard>
            <MetricCardHeader>
              <MetricCardTitle>Next ping due</MetricCardTitle>
            </MetricCardHeader>
            <MetricCardValue>
              {heartbeat.nextDueAt ? relative(heartbeat.nextDueAt) : "—"}
            </MetricCardValue>
          </MetricCard>
        </MetricCardGroup>
      </Section>
      {waiting && heartbeat.pingUrl ? (
        <Section>
          <EmptyStateContainer>
            <EmptyStateTitle>Waiting for first ping</EmptyStateTitle>
            <EmptyStateDescription>
              Alerts start after the first ping. Add the request below to the
              end of your job.
            </EmptyStateDescription>
          </EmptyStateContainer>
          <HeartbeatPingUrl pingUrl={heartbeat.pingUrl} />
        </Section>
      ) : (
        <Section>
          <SectionHeader>
            <SectionTitle>Pings</SectionTitle>
            <SectionDescription>
              Pings received per day over the last {DAYS} days
            </SectionDescription>
          </SectionHeader>
          <PingBars days={days ?? []} />
        </Section>
      )}
      <Section>
        <SectionHeader>
          <SectionTitle>Timeline</SectionTitle>
          <SectionDescription>
            What&apos;s happening in the last {DAYS} days
          </SectionDescription>
        </SectionHeader>
        <AuditLogsWrapper monitorId={String(monitor.id)} interval={DAYS} />
      </Section>
    </SectionGroup>
  );
}
