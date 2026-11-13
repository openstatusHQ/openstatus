"use client";

import { formatSlaUptime } from "@openstatus/db/src/schema/monitor_sla_policies/constants";
import { Shield } from "@openstatus/icons";
import { Button } from "@openstatus/ui/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@openstatus/ui/components/ui/select";
import { SelectTrigger } from "@radix-ui/react-select";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { parseAsInteger, parseAsNumberLiteral, useQueryState } from "nuqs";
import { useMemo, useState } from "react";

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
  SectionHeaderRow,
  SectionTitle,
} from "@/components/content/section";
import { getColumns } from "@/components/data-table/monitor-sla-policy-months/columns";
import {
  DialogExcusedWindow,
  type ExcusedWindowPrefill,
} from "@/components/forms/monitor-sla-policy/dialog-excused-window";
import { MonitorSlaExportPopover } from "@/components/forms/monitor-sla-policy/export-popover";
import {
  MetricCard,
  MetricCardGroup,
  MetricCardHeader,
  MetricCardTitle,
  MetricCardValue,
} from "@/components/metric/metric-card";
import { SlaMonitorMonthSheet } from "@/components/sla-policies/sla-monitor-month-sheet";
import {
  SlaMonthLegend,
  SlaMonthLegendItem,
} from "@/components/sla-policies/sla-month-strip";
import { SlaPolicyExcusedWindows } from "@/components/sla-policies/sla-policy-excused-windows";
import { SlaPolicyMaintenance } from "@/components/sla-policies/sla-policy-maintenance";
import { SlaPolicyPaywall } from "@/components/sla-policies/sla-policy-paywall";
import { DataTable } from "@/components/ui/data-table/data-table";
import { DataTableEmpty } from "@/components/ui/data-table/data-table-empty";
import {
  allowedDowntime,
  formatPendingTerms,
  formatSlaTarget,
} from "@/data/sla-policies.client";
import { formatDate } from "@/lib/formatter";
import { useTRPC } from "@/lib/trpc/client";

const MONTH_RANGES = [12, 24] as const;
const parseMonths = parseAsNumberLiteral(MONTH_RANGES).withDefault(12);

export function Client() {
  const { id } = useParams<{ id: string }>();
  const trpc = useTRPC();
  const [months, setMonths] = useQueryState("months", parseMonths);
  const [selected, setSelected] = useQueryState("monitor", parseAsInteger);
  const [excuse, setExcuse] = useState<{
    prefill: ExcusedWindowPrefill | null;
  } | null>(null);
  const { data: workspace } = useQuery(trpc.workspace.get.queryOptions());
  const { data: user } = useQuery(trpc.user.get.queryOptions());
  const { data: members } = useQuery(trpc.member.list.queryOptions());
  const allowed = workspace?.limits["monitor-sla"] === true;
  const { data: policy, isError } = useQuery({
    ...trpc.monitorSlaPolicy.get.queryOptions({
      id: Number.parseInt(id),
      months,
    }),
    enabled: allowed,
  });
  const { data: workspaceMonitors } = useQuery({
    ...trpc.monitor.list.queryOptions(),
    enabled: allowed && policy?.strict === true && !policy.archivedAt,
  });
  const columns = useMemo(
    () =>
      policy
        ? getColumns(policy.months, {
            timeZone: policy.timeZone,
            onSelect: (monitorId) => void setSelected(monitorId),
          })
        : [],
    [policy, setSelected],
  );

  if (!workspace) return null;

  if (!allowed) return <SlaPolicyPaywall />;

  if (isError) {
    return (
      <SectionGroup>
        <EmptyStateContainer>
          <EmptyStateMedia>
            <Shield />
          </EmptyStateMedia>
          <EmptyStateTitle>Policy not found</EmptyStateTitle>
          <EmptyStateDescription>
            It may have been deleted, or it belongs to another workspace.
          </EmptyStateDescription>
        </EmptyStateContainer>
      </SectionGroup>
    );
  }

  if (!policy) return null;

  const role = members?.find((m) => m.user.id === user?.id)?.role;
  const selectedMonitor =
    policy.monitors.find((m) => m.id === selected) ?? null;
  const canEdit = role === "owner" || role === "admin";
  const { missed, liveTerms, pendingTerms } = policy;
  const currentMonth = policy.months.at(-1);
  let lowest: { name: string; uptime: number; met: boolean } | null = null;
  for (const m of policy.monitors) {
    const month = m.months.at(-1);
    if (!month || month.month !== currentMonth || month.uptime === null)
      continue;
    if (lowest === null || month.uptime < lowest.uptime) {
      lowest = { name: m.name, uptime: month.uptime, met: month.met === true };
    }
  }
  // an archived policy is a record: no live warnings
  const live = policy.archivedAt === null;
  const neverSlow =
    live && policy.strict
      ? (workspaceMonitors ?? []).filter(
          (m) =>
            m.degradedAfter == null &&
            policy.monitors.some((pm) => pm.id === m.id),
        )
      : [];

  return (
    <SectionGroup>
      <Section id="policy">
        <SectionHeaderRow>
          <SectionHeader>
            <SectionTitle>{policy.name}</SectionTitle>
            <SectionDescription>
              {formatSlaTarget(liveTerms.target)}% monthly uptime per monitor ·{" "}
              {liveTerms.strict
                ? "slow responses count as down"
                : "slow responses count as up"}
              {pendingTerms ? (
                <>
                  {" "}
                  · {formatPendingTerms(pendingTerms)}
                  {pendingTerms.strict !== liveTerms.strict
                    ? pendingTerms.strict
                      ? ", slow responses counting as down"
                      : ", slow responses counting as up"
                    : null}
                </>
              ) : null}
              {policy.archivedAt ? (
                <>
                  {" "}
                  · archived {formatDate(policy.archivedAt)}, read-only, seals
                  no further months
                </>
              ) : null}
            </SectionDescription>
          </SectionHeader>
          <div className="flex items-center gap-2">
            <MonitorSlaExportPopover policyId={policy.id} />
            {policy.archivedAt ? null : (
              <Button size="sm" variant="outline" asChild>
                <Link href={`/sla-policies/monitors/${policy.id}/edit`}>
                  Settings
                </Link>
              </Button>
            )}
          </div>
        </SectionHeaderRow>
        <MetricCardGroup className="md:grid-cols-4 lg:grid-cols-4">
          <MetricCard>
            <MetricCardHeader>
              <MetricCardTitle className="uppercase">Target</MetricCardTitle>
            </MetricCardHeader>
            <MetricCardValue>
              {formatSlaTarget(liveTerms.target)}%{" "}
              <span className="text-muted-foreground text-sm font-normal">
                {allowedDowntime(liveTerms.target)} per month
                {pendingTerms ? ` · ${formatPendingTerms(pendingTerms)}` : null}
              </span>
            </MetricCardValue>
          </MetricCard>
          <MetricCard
            variant={
              lowest === null
                ? "default"
                : lowest.met
                  ? "success"
                  : "destructive"
            }
          >
            <MetricCardHeader>
              <MetricCardTitle className="uppercase">
                Lowest this month
              </MetricCardTitle>
            </MetricCardHeader>
            <MetricCardValue>
              {lowest === null ? "—" : `${formatSlaUptime(lowest.uptime)}%`}{" "}
              <span
                className="text-muted-foreground text-sm font-normal"
                title={lowest?.name}
              >
                provisional
                {lowest ? ` · ${lowest.name}` : null}
              </span>
            </MetricCardValue>
          </MetricCard>
          <MetricCard variant={missed.months > 0 ? "destructive" : "default"}>
            <MetricCardHeader>
              <MetricCardTitle className="uppercase">
                Months with a miss
              </MetricCardTitle>
            </MetricCardHeader>
            <MetricCardValue>
              {missed.months}{" "}
              <span className="text-muted-foreground text-sm font-normal">
                of the last {missed.of}
                {missed.previews > 0
                  ? ` · ${missed.previews} preview${missed.previews === 1 ? "" : "s"}`
                  : null}
              </span>
            </MetricCardValue>
          </MetricCard>
        </MetricCardGroup>
      </Section>

      <Section id="months">
        <SectionHeader>
          <SectionTitle>Months</SectionTitle>
          <SectionDescription>
            Each monitor is judged on its own, on the time it was up. Months run
            from midnight on the 1st in {policy.timeZone}. A month is sealed
            with the terms it started with once it has closed. The running month
            is live and provisional until it closes; a live month below target
            is a miss in progress, not a missed month. Pick a monitor to see
            what used its budget.
          </SectionDescription>
        </SectionHeader>
        <div className="text-sm">
          Uptime over the last{" "}
          <Select
            value={String(months)}
            onValueChange={(value) => setMonths(Number(value) as 12 | 24)}
          >
            <SelectTrigger asChild aria-label="Months shown">
              <Button
                variant="ghost"
                size="sm"
                className="decoration-border hover:decoration-foreground data-[state=open]:decoration-foreground h-auto rounded-md px-1 py-0 text-[length:inherit] leading-[inherit] font-medium underline underline-offset-3 hover:bg-transparent dark:hover:bg-transparent"
              >
                <SelectValue />
              </Button>
            </SelectTrigger>
            <SelectContent position="item-aligned">
              {MONTH_RANGES.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n} months
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DataTable
          columns={columns}
          data={policy.monitors}
          onRowClick={(row) => void setSelected(row.original.id)}
          defaultPagination={{
            pageIndex: 0,
            pageSize: policy.monitors.length || 1,
          }}
          emptyState={
            <DataTableEmpty>
              <EmptyStateMedia>
                <Shield />
              </EmptyStateMedia>
              <EmptyStateTitle>No monitors</EmptyStateTitle>
              <EmptyStateDescription>
                This policy covers no monitors yet.
              </EmptyStateDescription>
            </DataTableEmpty>
          }
        />
        <SlaMonthLegend>
          <SlaMonthLegendItem swatch="bg-success/30">Met</SlaMonthLegendItem>
          <SlaMonthLegendItem swatch="bg-destructive/30">
            Missed
          </SlaMonthLegendItem>
          <SlaMonthLegendItem swatch="bg-info/30">
            Live, provisional
          </SlaMonthLegendItem>
          <SlaMonthLegendItem swatch="border-muted-foreground border border-dashed">
            Preview, not sealed yet
          </SlaMonthLegendItem>
          <span>Filled: sealed, hover for its terms and method</span>
          <span>— no checks, or unavailable in this time zone</span>
          <span>Months in {policy.timeZone}</span>
          <span>
            Uptime in %, after excused downtime, floored to three decimals
          </span>
        </SlaMonthLegend>
        {live && policy.liveIncomplete ? (
          <p className="text-warning text-sm">
            Recent counts could not be loaded, so the recent weeks may be
            incomplete. Sealed months are not affected.
          </p>
        ) : null}
        {neverSlow.length > 0 ? (
          <p className="text-warning text-sm">
            {neverSlow.map((m) => m.name).join(", ")}{" "}
            {neverSlow.length === 1 ? "has" : "have"} no degraded threshold:
            {neverSlow.length === 1 ? " its" : " their"} checks are never slow,
            so slow responses counting as down changes nothing for{" "}
            {neverSlow.length === 1 ? "it" : "them"}.
          </p>
        ) : null}
      </Section>

      <SlaPolicyExcusedWindows
        policy={policy}
        canEdit={canEdit}
        onAdd={() => setExcuse({ prefill: null })}
      />

      <SlaPolicyMaintenance
        policyId={policy.id}
        months={months}
        onExcuse={
          policy.archivedAt || !canEdit
            ? undefined
            : (prefill) => setExcuse({ prefill })
        }
      />
      <SlaMonitorMonthSheet
        policy={policy}
        monitor={selectedMonitor}
        onClose={() => void setSelected(null)}
        onExcuse={
          policy.archivedAt || !canEdit
            ? undefined
            : (prefill) => {
                void setSelected(null);
                setExcuse({ prefill });
              }
        }
      />
      <DialogExcusedWindow
        policy={policy}
        prefill={excuse?.prefill ?? null}
        open={excuse !== null}
        onOpenChange={(open) => {
          if (!open) setExcuse(null);
        }}
      />
    </SectionGroup>
  );
}
