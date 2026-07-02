"use client";

import { Tabs, TabsList, TabsTrigger } from "@openstatus/ui/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useQueryStates } from "nuqs";
import { useMemo } from "react";

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
  SectionHeaderRow,
  SectionTitle,
} from "@/components/content/section";
import { getColumns } from "@/components/data-table/status-page-history/columns";
import { UptimeExplainer } from "@/components/data-table/status-page-history/uptime-explainer";
import {
  MetricCard,
  MetricCardGroup,
  MetricCardHeader,
  MetricCardTitle,
  MetricCardValue,
} from "@/components/metric/metric-card";
import { DataTable } from "@/components/ui/data-table/data-table";
import {
  HISTORY_WINDOWS,
  getColumnVisibility,
  monthKeyToLabel,
  parseWindow,
  windowKey,
} from "@/data/status-page-history";
import { useTRPC } from "@/lib/trpc/client";

import { searchParamsParsers } from "./search-params";

export function Client() {
  const { id } = useParams<{ id: string }>();
  const trpc = useTRPC();
  const [{ window }, setSearchParams] = useQueryStates(searchParamsParsers);

  // one 24-month fetch; the window tabs only toggle column visibility
  const { data: history } = useQuery(
    trpc.page.getUptimeHistory.queryOptions({ id: Number.parseInt(id) }),
  );

  const columns = useMemo(
    () => getColumns(history?.months ?? [], window),
    [history?.months, window],
  );
  const columnVisibility = useMemo(
    () => getColumnVisibility(window, history?.months.length ?? 0),
    [window, history?.months.length],
  );

  if (!history) return null;

  const summary = history.summary[windowKey(window)];
  const hasAnyData = history.rows.some((row) =>
    Object.values(row.months).some((value) => value !== null),
  );

  return (
    <SectionGroup>
      <Section>
        <SectionHeader>
          <SectionHeaderRow>
            <div>
              <SectionTitle>History</SectionTitle>
              <SectionDescription>
                Long-term uptime, frozen as immutable monthly snapshots.
              </SectionDescription>
            </div>
            <Tabs
              value={String(window)}
              onValueChange={(v) => setSearchParams({ window: parseWindow(v) })}
            >
              <TabsList>
                {HISTORY_WINDOWS.map((w) => (
                  <TabsTrigger key={w} value={String(w)}>
                    {w} months
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </SectionHeaderRow>
        </SectionHeader>
        <MetricCardGroup className="md:grid-cols-4 lg:grid-cols-4">
          <MetricCard variant="success">
            <MetricCardHeader>
              <MetricCardTitle className="uppercase">
                Page Uptime
              </MetricCardTitle>
            </MetricCardHeader>
            <MetricCardValue>
              {summary.uptime === null ? "—" : `${summary.uptime.toFixed(2)}%`}
            </MetricCardValue>
          </MetricCard>
          <MetricCard>
            <MetricCardHeader>
              <MetricCardTitle className="uppercase">Incidents</MetricCardTitle>
            </MetricCardHeader>
            <MetricCardValue>{summary.incidents}</MetricCardValue>
          </MetricCard>
          <MetricCard>
            <MetricCardHeader>
              <MetricCardTitle className="uppercase">
                Components
              </MetricCardTitle>
            </MetricCardHeader>
            <MetricCardValue>{history.rows.length}</MetricCardValue>
          </MetricCard>
          <MetricCard>
            <MetricCardHeader>
              <MetricCardTitle className="uppercase">
                Oldest Record
              </MetricCardTitle>
            </MetricCardHeader>
            <MetricCardValue>
              {history.oldestRecord
                ? monthKeyToLabel(history.oldestRecord)
                : "—"}
            </MetricCardValue>
          </MetricCard>
        </MetricCardGroup>
        {hasAnyData ? (
          <div className="overflow-x-auto">
            <DataTable
              columns={columns}
              data={history.rows}
              columnVisibility={columnVisibility}
              defaultPagination={{ pageIndex: 0, pageSize: 100 }}
            />
          </div>
        ) : (
          <EmptyStateContainer>
            <EmptyStateTitle>No history yet</EmptyStateTitle>
            <EmptyStateDescription>
              The first{" "}
              <span className="text-foreground font-medium">snapshot</span>{" "}
              freezes on the{" "}
              <span className="text-foreground font-medium">
                10th of next month
              </span>{" "}
              — until then, the current month is served live.
            </EmptyStateDescription>
          </EmptyStateContainer>
        )}
        <UptimeExplainer />
      </Section>
    </SectionGroup>
  );
}
