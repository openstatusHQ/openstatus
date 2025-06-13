"use client";

import {
  Section,
  SectionDescription,
  SectionGroup,
  SectionHeader,
  SectionTitle,
} from "@/components/content/section";
import {
  MetricCardGroup,
  MetricCardHeader,
  MetricCardTitle,
  MetricCardValue,
  MetricCardButton,
} from "@/components/metric/metric-card";
import { DataTable } from "@/components/ui/data-table/data-table";
import { monitors } from "@/data/monitors";
import { columns } from "@/components/data-table/monitors/columns";
import { MonitorDataTableActionBar } from "@/components/data-table/monitors/data-table-action-bar";
import { MonitorDataTableToolbar } from "@/components/data-table/monitors/data-table-toolbar";
import { ArrowDown, CheckCircle, ListFilter } from "lucide-react";
import type { ColumnFiltersState, SortingState } from "@tanstack/react-table";
import { useState } from "react";
import { DataTablePaginationSimple } from "@/components/ui/data-table/data-table-pagination";
import { useRouter } from "next/navigation";

// NOTE: connect with table filter and sorting
const metrics = [
  {
    title: "Normal",
    value: monitors.filter((monitor) => monitor.status === "Normal").length,
    variant: "success" as const,
    type: "filter" as const,
  },
  {
    title: "Degraded",
    value: monitors.filter((monitor) => monitor.status === "Degraded").length,
    variant: "warning" as const,
    type: "filter" as const,
  },
  {
    title: "Failing",
    value: monitors.filter((monitor) => monitor.status === "Failing").length,
    variant: "destructive" as const,
    type: "filter" as const,
  },
  {
    title: "Inactive",
    value: monitors.filter((monitor) => monitor.status === "Inactive").length,
    variant: "default" as const,
    type: "filter" as const,
  },
  {
    title: "Slowest Endpoint",
    value: "530ms",
    variant: "ghost" as const,
    type: "sorting" as const,
  },
];

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

export default function Page() {
  const router = useRouter();
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = useState<SortingState>([]);

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
                      router.push("/dashboard/monitors");
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
          data={monitors}
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
