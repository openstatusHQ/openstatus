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
import { columns } from "@/components/data-table/monitor-sla-policy-maintenance/columns";
import type { ExcusedWindowPrefill } from "@/components/forms/monitor-sla-policy/dialog-excused-window";
import { DataTable } from "@/components/ui/data-table/data-table";
import { formatSlaMonth } from "@/data/sla-policies.client";
import { formatDurationShort, formatWindow } from "@/lib/formatter";
import { useTRPC } from "@/lib/trpc/client";

/** Status page maintenances that touched a policy's monitors, newest month first. */
export function SlaPolicyMaintenance({
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
    trpc.monitorSlaPolicy.maintenances.queryOptions({ id: policyId, months }),
  );
  if (!data) return null;

  const paused = new Map(
    data.monitors
      .filter((m) => m.maintenanceMode === "pause")
      .map((m) => [m.id, m.name]),
  );
  const names = new Map(
    data.monitors.map((m) => [
      m.id,
      m.maintenanceMode === "pause" ? `${m.name} (paused)` : m.name,
    ]),
  );
  const groups = [...data.months]
    .reverse()
    .map((month) => ({
      month,
      windows: data.windows.filter((w) => w.months.includes(month)),
    }))
    .filter((g) => g.windows.length > 0);

  return (
    <Section id="maintenance">
      <SectionHeader>
        <SectionTitle>Maintenance</SectionTitle>
        <SectionDescription>
          Status page maintenance windows that touched this policy&apos;s
          monitors. While a window is active, a monitor set to pause is not
          checked at all: that time is left out of both sides of its uptime and
          is never counted. A monitor set to continue is checked as usual, and
          the window counts like any other time unless you excuse it.
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
            None of the status pages showing these monitors had a maintenance in
            the last {months} months.
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
                  <EventRow key={w.id}>
                    <EventRowDate date={w.from} />
                    <EventRowStatus>
                      <StatusDot variant="info" />
                      <span>{w.pageTitle ?? "Maintenance"}</span>
                    </EventRowStatus>
                    <EventRowContent>
                      <EventRowTitle
                        href={
                          w.pageId
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
                      </EventRowMeta>
                    </EventRowContent>
                    <EventRowDuration>
                      {formatDurationShort(w.to.getTime() - w.from.getTime())}
                    </EventRowDuration>
                    {onExcuse ? (
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
                              pausedMonitors: w.monitorIds.flatMap((id) => {
                                const name = paused.get(id);
                                return name ? [name] : [];
                              }),
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
