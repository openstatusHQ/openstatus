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
import { columns } from "@/components/data-table/monitor-reporting-maintenance/columns";
import type { ExcusedWindowPrefill } from "@/components/forms/monitor-reporting/dialog-excused-window";
import { DataTable } from "@/components/ui/data-table/data-table";
import { formatSlaMonth } from "@/data/reportings.client";
import { formatDurationShort, formatWindow } from "@/lib/formatter";
import { useTRPC } from "@/lib/trpc/client";

/** Maintenance windows and status page maintenances that touched a reporting's monitors, newest month first. */
export function ReportingMaintenance({
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
    trpc.monitorReporting.maintenances.queryOptions({ id: policyId, months }),
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
          Maintenance windows and status page maintenances that touched this
          reporting&apos;s monitors. While one that pauses checks is active, its
          monitors are not checked at all: that time is left out of both sides
          of their uptime and is never counted. Under one that keeps checking,
          monitors are checked as usual and the time counts like any other
          unless you excuse it. Status page maintenances always pause checks.
        </SectionDescription>
      </SectionHeader>
      {data.monitors.length > 0 ? (
        <DataTable
          columns={columns}
          data={data.monitors}
          defaultPagination={{
            pageIndex: 0,
            pageSize: data.monitors.length,
          }}
        />
      ) : null}
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
                        {w.kind === "window"
                          ? "Maintenance window"
                          : (w.pageTitle ?? "Maintenance")}
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
