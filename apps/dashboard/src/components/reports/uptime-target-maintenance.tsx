"use client";

import { Maintenance } from "@openstatus/icons";
import { Button } from "@openstatus/ui/components/ui/button";
import { useQuery } from "@tanstack/react-query";

import { StatusDot } from "@/components/common/status-dot";
import {
  EmptyStateContainer,
  EmptyStateDescription,
  EmptyStateMedia,
  EmptyStateTitle,
} from "@/components/content/empty-state";
import {
  EventGroup,
  EventGroupCount,
  EventGroupHeader,
  EventGroupTitle,
} from "@/components/content/event-group";
import {
  EventList,
  EventRow,
  EventRowContent,
  EventRowDate,
  EventRowDuration,
  EventRowMenu,
  EventRowMeta,
  EventRowStatus,
  EventRowTitle,
} from "@/components/content/event-list";
import {
  Section,
  SectionDescription,
  SectionHeader,
  SectionTitle,
} from "@/components/content/section";
import type { ExcusedWindowPrefill } from "@/components/forms/uptime-target/dialog-excused-window";
import { formatSlaMonth } from "@/data/reports.client";
import { formatDurationShort, formatWindow } from "@/lib/formatter";
import { useTRPC } from "@/lib/trpc/client";

/** Maintenance windows and status page maintenances that touched an uptime target's monitors, newest month first. */
export function UptimeTargetMaintenance({
  policyId,
  months,
  onExcuse,
}: {
  policyId: number;
  months: 12 | 24;
  /** turns a window into an excused window, times prefilled and editable */
  onExcuse?: (prefill: ExcusedWindowPrefill) => void;
}) {
  const trpc = useTRPC();
  const { data } = useQuery(
    trpc.uptimeTarget.maintenances.queryOptions({ id: policyId, months }),
  );
  if (!data) return null;

  const names = new Map(data.monitors.map((m) => [m.id, m.name]));
  const groups = [...data.months]
    .reverse()
    .map((month) => ({
      month,
      windows: data.windows.filter((w) => w.month === month),
    }))
    .filter((g) => g.windows.length > 0);

  return (
    <Section id="maintenance">
      <SectionHeader>
        <SectionTitle>Maintenance</SectionTitle>
        <SectionDescription>
          Planned work on this uptime target&apos;s monitors. Paused time is
          never counted; time under a window that keeps checking counts unless
          you excuse it.
        </SectionDescription>
      </SectionHeader>
      {groups.length === 0 ? (
        <EmptyStateContainer>
          <EmptyStateMedia>
            <Maintenance />
          </EmptyStateMedia>
          <EmptyStateTitle>No maintenance windows</EmptyStateTitle>
          <EmptyStateDescription>
            None of these monitors had a maintenance in the last {months}{" "}
            months.
          </EmptyStateDescription>
        </EmptyStateContainer>
      ) : (
        <div className="flex flex-col gap-6">
          {groups.map(({ month, windows }) => (
            <EventGroup key={month}>
              <EventGroupHeader>
                <EventGroupTitle>
                  {formatSlaMonth(month, { year: true })}
                  <EventGroupCount>{windows.length}</EventGroupCount>
                </EventGroupTitle>
              </EventGroupHeader>
              <EventList>
                {windows.map((w) => (
                  <EventRow key={`${w.kind}:${w.id}`}>
                    <EventRowDate date={w.from} />
                    <EventRowStatus>
                      <StatusDot variant="info" />
                      <span>
                        {w.kind === "window" ? "Window" : "Status page"}
                      </span>
                    </EventRowStatus>
                    <EventRowContent>
                      <EventRowTitle
                        href={
                          w.kind === "page" && w.pageId
                            ? `/status-pages/${w.pageId}/maintenances/${w.id}`
                            : undefined
                        }
                      >
                        {w.title}
                      </EventRowTitle>
                      <EventRowMeta>
                        {w.announcements.length ? (
                          <span>
                            {w.kind === "window" ? "announced on " : null}
                            {w.announcements
                              .map((a) => a.pageTitle ?? "a status page")
                              .join(", ")}
                          </span>
                        ) : null}
                        <span>
                          {w.monitorIds
                            .map((id) => names.get(id) ?? "")
                            .join(", ")}
                        </span>
                        <span>{formatWindow(w.from, w.to)}</span>
                        <span>
                          {w.mode === "pause"
                            ? "Checks paused"
                            : "Checks continued"}
                        </span>
                      </EventRowMeta>
                    </EventRowContent>
                    <EventRowDuration>
                      {formatDurationShort(w.to.getTime() - w.from.getTime())}
                    </EventRowDuration>
                    {onExcuse && w.excusable ? (
                      <EventRowMenu>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7"
                          onClick={() =>
                            onExcuse({
                              from: w.from,
                              to: w.to,
                              kind: "maintenance",
                              reason: w.title,
                              monitorIds: w.monitorIds,
                              monitorMaintenanceWindowId:
                                w.kind === "window" ? w.id : undefined,
                              announcements: w.announcements,
                            })
                          }
                        >
                          Excuse
                        </Button>
                      </EventRowMenu>
                    ) : null}
                  </EventRow>
                ))}
              </EventList>
            </EventGroup>
          ))}
        </div>
      )}
    </Section>
  );
}
