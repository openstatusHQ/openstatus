"use client";

import type { RouterInputs } from "@openstatus/api";
import { ArrowDown, Success, ListFilter, Monitor } from "@openstatus/icons";
import { Button } from "@openstatus/ui/components/ui/button";
import { useQueries, useQuery } from "@tanstack/react-query";
import type { ColumnFiltersState, SortingState } from "@tanstack/react-table";
import NextLink from "next/link";
import { useQueryStates } from "nuqs";
import { useEffect, useRef, useState } from "react";

import {
  EmptyStateActions,
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
import { columns } from "@/components/data-table/monitors/columns";
import { MonitorDataTableActionBar } from "@/components/data-table/monitors/data-table-action-bar";
import { MonitorDataTableToolbar } from "@/components/data-table/monitors/data-table-toolbar";
import {
  MetricCardButton,
  MetricCardGroup,
  MetricCardHeader,
  MetricCardSkeleton,
  MetricCardTitle,
  MetricCardValue,
} from "@/components/metric/metric-card";
import { DataTable } from "@/components/ui/data-table/data-table";
import { DataTableEmpty } from "@/components/ui/data-table/data-table-empty";
import { DataTablePaginationSimple } from "@/components/ui/data-table/data-table-pagination";
import { getMonitorListMetrics } from "@/data/metrics.client";
import { useTRPC } from "@/lib/trpc/client";

import { CreateMonitorButton } from "./create-monitor-button";
import { type MonitorStatus, searchParamsParsers } from "./search-params";

type MetricType = NonNullable<
  RouterInputs["tinybird"]["globalMetrics"]["type"]
>;

// Job types with a tinybird metrics pipe (udp/ssl have none yet). The record
// is keyed by the server enum so a type added there fails typecheck here.
const METRIC_TYPES = Object.keys({
  http: true,
  tcp: true,
  dns: true,
  icmp: true,
  grpc: true,
} satisfies Record<MetricType, true>) as MetricType[];

const icons = {
  default: {
    active: Success,
    inactive: ListFilter,
  },
  p95: {
    active: ArrowDown,
    inactive: ListFilter,
  },
} as const;

export function Client() {
  const trpc = useTRPC();
  const { data: monitors } = useQuery(trpc.monitor.list.queryOptions());
  const { data: tags } = useQuery(trpc.monitorTag.list.queryOptions());
  const [searchParams, setSearchParams] = useQueryStates(searchParamsParsers);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  // latest values for updater chains within one tick (the render closure lags)
  const sortingRef = useRef(sorting);
  const columnFiltersRef = useRef(columnFilters);

  const metricQueries = useQueries({
    queries: METRIC_TYPES.map((type) => {
      const monitorIds =
        monitors
          ?.filter((m) => m.jobType === type)
          .map((m) => m.id.toString()) ?? [];
      return {
        ...trpc.tinybird.globalMetrics.queryOptions({ monitorIds, type }),
        enabled: monitorIds.length > 0,
      };
    }),
  });
  const isLoadingMetrics = metricQueries.some((q) => q.isLoading);
  const globalMetrics = metricQueries.flatMap((q) => q.data?.data ?? []);

  // TODO: ideally we read from the searchParamsCache and there is no layout shift
  useEffect(() => {
    if (searchParams.status?.length) {
      columnFiltersRef.current = [{ id: "status", value: searchParams.status }];
      setColumnFilters(columnFiltersRef.current);
    }
    if (searchParams.sort) {
      sortingRef.current = [searchParams.sort];
      setSorting(sortingRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!monitors) return null;

  const metrics = getMonitorListMetrics(monitors, globalMetrics);

  // every filter or sort change goes through here, from the table or the cards,
  // so the URL mirrors the state
  const onColumnFiltersChange: React.Dispatch<
    React.SetStateAction<ColumnFiltersState>
  > = (updater) => {
    const next =
      typeof updater === "function"
        ? updater(columnFiltersRef.current)
        : updater;
    columnFiltersRef.current = next;
    setColumnFilters(next);
    const status = next.find((f) => f.id === "status")?.value as
      | MonitorStatus[]
      | undefined;
    setSearchParams({ status: status?.length ? status : null });
  };
  const onSortingChange: React.Dispatch<React.SetStateAction<SortingState>> = (
    updater,
  ) => {
    const next =
      typeof updater === "function" ? updater(sortingRef.current) : updater;
    sortingRef.current = next;
    setSorting(next);
    setSearchParams({ sort: next[0] ?? null });
  };

  return (
    <SectionGroup>
      <Section>
        <SectionHeaderRow>
          <SectionHeader>
            <SectionTitle>Monitors</SectionTitle>
            <SectionDescription>
              Create and manage your monitors.
            </SectionDescription>
          </SectionHeader>
          <div>
            <CreateMonitorButton />
          </div>
        </SectionHeaderRow>
        <MetricCardGroup>
          {metrics.map((metric) => {
            const statusArray = columnFilters.find((f) => f.id === "status")
              ?.value as string[] | undefined;

            let isActive = false;
            if (metric.key === "p95") {
              isActive = !!sorting.find((s) => s.id === "p95" && s.desc);
            } else {
              isActive =
                Array.isArray(statusArray) && statusArray.includes(metric.key);
            }

            const iconGroup = metric.key === "p95" ? icons.p95 : icons.default;
            const Icon = iconGroup[isActive ? "active" : "inactive"];

            return (
              <MetricCardButton
                key={metric.title}
                variant={metric.variant}
                onClick={() => {
                  if (metric.key === "p95") {
                    onSortingChange(
                      sorting.length === 0 || !isActive
                        ? [{ id: "p95", desc: true }]
                        : [],
                    );
                  } else {
                    onColumnFiltersChange(
                      columnFilters.length === 0 || !isActive
                        ? [{ id: "status", value: [metric.key] }]
                        : [],
                    );
                  }
                }}
              >
                <MetricCardHeader className="flex w-full items-center justify-between gap-2">
                  <MetricCardTitle className="truncate">
                    {metric.title}
                  </MetricCardTitle>
                  <Icon className="size-4" />
                </MetricCardHeader>
                {metric.key === "p95" && isLoadingMetrics ? (
                  <MetricCardSkeleton className="h-6 w-12" />
                ) : (
                  <MetricCardValue>{metric.value}</MetricCardValue>
                )}
              </MetricCardButton>
            );
          })}
        </MetricCardGroup>
      </Section>
      <Section>
        <DataTable
          columns={columns}
          data={monitors.map((monitor) => ({
            ...monitor,
            globalMetrics: isLoadingMetrics
              ? undefined
              : (globalMetrics.find(
                  (m) => m.monitorId === monitor.id.toString(),
                ) ?? false),
          }))}
          actionBar={MonitorDataTableActionBar}
          toolbarComponent={(props) => (
            <MonitorDataTableToolbar {...props} tags={tags ?? []} />
          )}
          paginationComponent={DataTablePaginationSimple}
          emptyState={
            <DataTableEmpty>
              <EmptyStateMedia>
                <Monitor />
              </EmptyStateMedia>
              <EmptyStateTitle>No monitors yet</EmptyStateTitle>
              <EmptyStateDescription>
                A monitor checks an endpoint on a schedule from the regions you
                pick and alerts you when it degrades or fails.
              </EmptyStateDescription>
              <EmptyStateActions>
                <Button size="sm" asChild>
                  <NextLink href="/monitors/create">Create monitor</NextLink>
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <NextLink href="/agents/cli">Import via CLI</NextLink>
                </Button>
              </EmptyStateActions>
            </DataTableEmpty>
          }
          columnFilters={columnFilters}
          setColumnFilters={onColumnFiltersChange}
          sorting={sorting}
          setSorting={onSortingChange}
          defaultColumnVisibility={{
            active: false,
            url: false,
            jobType: false,
          }}
        />
      </Section>
    </SectionGroup>
  );
}
