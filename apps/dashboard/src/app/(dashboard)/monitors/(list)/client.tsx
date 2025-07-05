"use client";

import {
  Section,
  SectionDescription,
  SectionGroup,
  SectionHeader,
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
import { DataTablePaginationSimple } from "@/components/ui/data-table/data-table-pagination";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery } from "@tanstack/react-query";
import type { ColumnFiltersState, SortingState } from "@tanstack/react-table";
import { ArrowDown, CheckCircle, ListFilter } from "lucide-react";
import { useEffect, useState } from "react";
import { getMonitorListMetrics } from "@/data/metrics.client";
import { useQueryStates } from "nuqs";
import { searchParamsParsers } from "./search-params";

const icons = {
  default: {
    active: CheckCircle,
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
  const [searchParams, setSearchParams] = useQueryStates(searchParamsParsers);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const monitorsByType = {
    http:
      monitors
        ?.filter((m) => m.jobType === "http")
        .map((m) => m.id.toString()) ?? [],
    tcp:
      monitors
        ?.filter((m) => m.jobType === "tcp")
        .map((m) => m.id.toString()) ?? [],
  };
  const { http: httpMonitors, tcp: tcpMonitors } = monitorsByType;

  // HMM: why do we need two queries?
  const { data: globalHttpMetrics, isLoading: isLoadingHttp } = useQuery({
    ...trpc.tinybird.globalMetrics.queryOptions({
      monitorIds: httpMonitors,
      type: "http",
    }),
    enabled: httpMonitors.length > 0,
  });

  const { data: globalTcpMetrics, isLoading: isLoadingTcp } = useQuery({
    ...trpc.tinybird.globalMetrics.queryOptions({
      monitorIds: tcpMonitors,
      type: "tcp",
    }),
    enabled: tcpMonitors.length > 0,
  });

  // TODO: ideally we read from the searchParamsCache and there is no layout shift
  useEffect(() => {
    if (searchParams.status) {
      setColumnFilters([{ id: "status", value: [searchParams.status] }]);
    }
    if (searchParams.sort) {
      setSorting([searchParams.sort]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!monitors) return null;

  const metrics = getMonitorListMetrics(monitors, [
    ...(globalHttpMetrics?.data ?? []),
    ...(globalTcpMetrics?.data ?? []),
  ]);

  return (
    <SectionGroup>
      <Section>
        <SectionHeader>
          <SectionTitle>Monitors</SectionTitle>
          <SectionDescription>
            Create and manage your monitors.
          </SectionDescription>
        </SectionHeader>
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
                    if (sorting.length === 0 || !isActive) {
                      setSearchParams({ sort: { id: "p95", desc: true } });
                      setSorting([{ id: "p95", desc: true }]);
                    } else {
                      setSearchParams({ sort: null });
                      setSorting([]);
                    }
                  } else {
                    if (columnFilters.length === 0 || !isActive) {
                      setSearchParams({ status: metric.key });
                      setColumnFilters([{ id: "status", value: [metric.key] }]);
                    } else {
                      setSearchParams({ status: null });
                      setColumnFilters([]);
                    }
                  }
                }}
              >
                <MetricCardHeader className="flex w-full items-center justify-between gap-2">
                  <MetricCardTitle className="truncate">
                    {metric.title}
                  </MetricCardTitle>
                  <Icon className="size-4" />
                </MetricCardHeader>
                {metric.key === "p95" && (isLoadingHttp || isLoadingTcp) ? (
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
            globalMetrics:
              isLoadingHttp || isLoadingTcp
                ? undefined
                : monitor.jobType === "http"
                  ? (globalHttpMetrics?.data?.find(
                      (m) => m.monitorId === monitor.id.toString()
                    ) ?? false)
                  : (globalTcpMetrics?.data?.find(
                      (m) => m.monitorId === monitor.id.toString()
                    ) ?? false),
          }))}
          actionBar={MonitorDataTableActionBar}
          toolbarComponent={MonitorDataTableToolbar}
          paginationComponent={DataTablePaginationSimple}
          columnFilters={columnFilters}
          setColumnFilters={setColumnFilters}
          sorting={sorting}
          setSorting={setSorting}
          defaultColumnVisibility={{ active: false }}
        />
      </Section>
    </SectionGroup>
  );
}
