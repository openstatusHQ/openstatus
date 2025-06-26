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
  MetricCardTitle,
  MetricCardValue,
} from "@/components/metric/metric-card";
import { DataTable } from "@/components/ui/data-table/data-table";
import { DataTablePaginationSimple } from "@/components/ui/data-table/data-table-pagination";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery } from "@tanstack/react-query";
import type { ColumnFiltersState, SortingState } from "@tanstack/react-table";
import { ArrowDown, CheckCircle, ListFilter } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { getMonitorListMetrics } from "@/data/metrics.client";

const icons = {
  filter: {
    active: CheckCircle,
    inactive: ListFilter,
  },
  sorting: {
    active: ArrowDown,
    inactive: ListFilter,
  },
};

export function Client() {
  const trpc = useTRPC();
  const { data: monitors } = useQuery(trpc.monitor.list.queryOptions());
  const router = useRouter();
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = useState<SortingState>([]);

  const httpMonitors =
    monitors
      ?.filter((monitor) => monitor.jobType === "http")
      .map((monitor) => monitor.id.toString()) ?? [];
  const tcpMonitors =
    monitors
      ?.filter((monitor) => monitor.jobType === "tcp")
      .map((monitor) => monitor.id.toString()) ?? [];

  const { data: globalHttpMetrics } = useQuery({
    ...trpc.tinybird.globalMetrics.queryOptions({
      monitorIds: httpMonitors,
      type: "http",
    }),
    enabled: httpMonitors.length > 0,
  });

  const { data: globalTcpMetrics } = useQuery({
    ...trpc.tinybird.globalMetrics.queryOptions({
      monitorIds: tcpMonitors,
      type: "tcp",
    }),
    enabled: tcpMonitors.length > 0,
  });

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
            const array = columnFilters.find(
              (filter) => filter.id === "status"
            )?.value;
            const isFilterActive =
              Array.isArray(array) && array?.includes(metric.title);
            const isSortingActive = sorting.find(
              (sort) => sort.id === "p99"
            )?.desc;

            const isActive =
              metric.type === "filter" ? isFilterActive : isSortingActive;

            const Icon = icons[metric.type][isActive ? "active" : "inactive"];

            return (
              <MetricCardButton
                key={metric.title}
                variant={metric.variant}
                onClick={() => {
                  // NOTE: can be refactored into the array object
                  if (metric.type === "filter") {
                    if (columnFilters.length === 0 || !isFilterActive) {
                      router.push(`?status=${metric.title}`);
                      setColumnFilters([
                        { id: "status", value: [metric.title] },
                      ]);
                    } else {
                      setColumnFilters([]);
                      // reset URL params
                      router.push("/monitors");
                    }
                  } else if (metric.type === "sorting") {
                    if (sorting.length === 0 || !isActive) {
                      setSorting([{ id: "p99", desc: true }]);
                    } else {
                      setSorting([]);
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
                <MetricCardValue>{metric.value}</MetricCardValue>
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
              monitor.jobType === "http"
                ? globalHttpMetrics?.data?.find(
                    (m) => m.monitorId === monitor.id.toString()
                  )
                : globalTcpMetrics?.data?.find(
                    (m) => m.monitorId === monitor.id.toString()
                  ),
          }))}
          actionBar={MonitorDataTableActionBar}
          toolbarComponent={MonitorDataTableToolbar}
          paginationComponent={DataTablePaginationSimple}
          columnFilters={columnFilters}
          setColumnFilters={setColumnFilters}
          sorting={sorting}
          setSorting={setSorting}
        />
      </Section>
    </SectionGroup>
  );
}
