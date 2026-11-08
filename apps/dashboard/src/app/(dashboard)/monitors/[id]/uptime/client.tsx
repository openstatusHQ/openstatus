"use client";

import { Calendar, Lock } from "@openstatus/icons";
import { cn } from "@openstatus/ui/lib/utils";
import { heartbeatExpectation } from "@openstatus/utils";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";

import {
  Activity,
  ActivityHeader,
  ActivityPeriod,
  ActivityTitle,
} from "@/components/content/activity";
import {
  ActivityCalendar,
  ActivityCalendarCell,
  ActivityCalendarGrid,
  ActivityCalendarLegend,
  ActivityCalendarLegendItem,
  ActivityCalendarLegendSeparator,
} from "@/components/content/activity-calendar";
import {
  BillingOverlay,
  BillingOverlayButton,
  BillingOverlayContainer,
  BillingOverlayDescription,
} from "@/components/content/billing-overlay";
import {
  EmptyStateContainer,
  EmptyStateDescription,
  EmptyStateMedia,
  EmptyStateTitle,
} from "@/components/content/empty-state";
import {
  Section,
  SectionDescription,
  SectionGroup,
  SectionHeader,
  SectionTitle,
} from "@/components/content/section";
import { UpgradeDialog } from "@/components/dialogs/upgrade";
import {
  exampleUptimeCounts,
  formatUptime,
  quorumNote,
  quorumSince,
  uptimeYears,
  utcToday,
} from "@/data/uptime-history.client";
import { useTRPC } from "@/lib/trpc/client";

export function Client() {
  const { id } = useParams<{ id: string }>();
  const trpc = useTRPC();
  const [openDialog, setOpenDialog] = useState(false);

  const { data: workspace } = useQuery(trpc.workspace.get.queryOptions());
  const { data: monitor } = useQuery(
    trpc.monitor.get.queryOptions({ id: Number.parseInt(id) }),
  );
  const isLimited = workspace?.limits["uptime-history"] === false;
  const { data: history } = useQuery({
    ...trpc.monitor.getUptimeHistory.queryOptions({ id: Number.parseInt(id) }),
    enabled: !!workspace && !isLimited,
  });

  const now = useMemo(() => new Date(), []);
  const today = useMemo(() => utcToday(now), [now]);
  const counts = isLimited ? exampleUptimeCounts(now) : history?.days;
  const regionCount = isLimited ? null : (history?.regionCount ?? null);
  const years = useMemo(
    () => uptimeYears(counts ?? [], regionCount, now),
    [counts, regionCount, now],
  );
  const since = useMemo(
    () => quorumSince(counts ?? [], regionCount),
    [counts, regionCount],
  );

  if (!monitor || !workspace || (!isLimited && !history)) return null;

  const calendars = (
    <div
      aria-hidden={isLimited}
      className={cn(
        "flex flex-col gap-6",
        isLimited && "pointer-events-none blur-sm select-none",
      )}
    >
      {history?.partial ? (
        <p className="text-muted-foreground text-sm">
          Recent checks couldn't be loaded, so the last few weeks may be
          incomplete.
        </p>
      ) : null}
      {since ? (
        <p className="text-muted-foreground text-sm">{quorumNote(since)}</p>
      ) : null}
      {years.map(({ year, days, uptime, failedDays }) => (
        <Activity key={year}>
          <ActivityHeader>
            <ActivityTitle>{year}</ActivityTitle>
            <ActivityPeriod>
              {uptime === null
                ? "No checks"
                : `${formatUptime(uptime, 3)} uptime`}
              {failedDays > 0
                ? ` · ${failedDays} ${failedDays === 1 ? "day" : "days"} with failures`
                : null}
            </ActivityPeriod>
          </ActivityHeader>
          <ActivityCalendar>
            <ActivityCalendarGrid days={days} today={today} />
          </ActivityCalendar>
        </Activity>
      ))}
      <ActivityCalendar>
        <ActivityCalendarLegend>
          <ActivityCalendarLegendItem>
            <ActivityCalendarCell level={0} />
            No failures
          </ActivityCalendarLegendItem>
          <ActivityCalendarLegendItem>
            <ActivityCalendarCell level={1} />
            {"< 1% failed"}
          </ActivityCalendarLegendItem>
          <ActivityCalendarLegendItem>
            <ActivityCalendarCell level={2} />≤ 5%
          </ActivityCalendarLegendItem>
          <ActivityCalendarLegendItem>
            <ActivityCalendarCell level={3} />
            {"> 5%"}
          </ActivityCalendarLegendItem>
          <ActivityCalendarLegendSeparator />
          <ActivityCalendarLegendItem>
            <ActivityCalendarCell hatched />
            No checks
          </ActivityCalendarLegendItem>
          <ActivityCalendarLegendSeparator />
          <ActivityCalendarLegendItem>Days in UTC</ActivityCalendarLegendItem>
        </ActivityCalendarLegend>
      </ActivityCalendar>
    </div>
  );

  return (
    <SectionGroup>
      <Section id="uptime">
        <SectionHeader>
          <SectionTitle>{monitor.name}</SectionTitle>
          <SectionDescription>
            {monitor.jobType === "http" ? (
              <a href={monitor.url} target="_blank" rel="noopener noreferrer">
                {monitor.url}
              </a>
            ) : monitor.jobType === "heartbeat" ? (
              `Heartbeat · ${heartbeatExpectation(monitor)}`
            ) : (
              monitor.url
            )}
          </SectionDescription>
        </SectionHeader>
        {isLimited ? (
          <BillingOverlayContainer>
            {calendars}
            <BillingOverlay>
              <BillingOverlayButton
                data-track="paywall_viewed"
                data-limit="uptime-history"
                onClick={() => setOpenDialog(true)}
              >
                <Lock />
                Upgrade
              </BillingOverlayButton>
              <BillingOverlayDescription>
                Keep every day of your monitor's uptime, year after year.
              </BillingOverlayDescription>
            </BillingOverlay>
            <UpgradeDialog
              open={openDialog}
              onOpenChange={setOpenDialog}
              limit="uptime-history"
            />
          </BillingOverlayContainer>
        ) : years.length === 0 ? (
          <EmptyStateContainer>
            <EmptyStateMedia>
              <Calendar />
            </EmptyStateMedia>
            <EmptyStateTitle>No checks yet</EmptyStateTitle>
            <EmptyStateDescription>
              Each day fills in once the monitor has run its first checks.
            </EmptyStateDescription>
          </EmptyStateContainer>
        ) : (
          calendars
        )}
      </Section>
    </SectionGroup>
  );
}
