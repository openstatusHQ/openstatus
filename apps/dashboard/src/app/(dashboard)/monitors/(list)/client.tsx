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
  const [sorting, setSorting] = useState<SortingState>([]);
  const [searchParams, setSearchParams] = useQueryStates(searchParamsParsers);
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

  useEffect(() => {
    if (searchParams.status) {
      setColumnFilters([{ id: "status", value: [searchParams.status] }]);
    }
    if (searchParams.active) {
      setColumnFilters([{ id: "active", value: [searchParams.active] }]);
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
            const activeArray = columnFilters.find((f) => f.id === "active")
              ?.value as boolean[] | undefined;

            let isActive = false;
            if (metric.key === "p95") {
              isActive = !!sorting.find((s) => s.id === "p99" && s.desc);
            } else if (metric.key === "inactive") {
              isActive =
                Array.isArray(activeArray) && activeArray.includes(false);
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
                      setSorting([{ id: "p99", desc: true }]);
                    } else {
                      setSorting([]);
                    }
                  } else if (metric.key === "inactive") {
                    if (columnFilters.length === 0 || !isActive) {
                      setSearchParams({ active: false, status: null });
                      setColumnFilters([{ id: "active", value: [false] }]);
                    } else {
                      setSearchParams({ active: null });
                      setColumnFilters([]);
                    }
                  } else {
                    if (columnFilters.length === 0 || !isActive) {
                      setSearchParams({ status: metric.key, active: null });
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
