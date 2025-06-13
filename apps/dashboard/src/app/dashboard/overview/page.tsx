import {
  SectionDescription,
  SectionGroup,
  SectionHeader,
  SectionHeaderRow,
  SectionTitle,
} from "@/components/content/section";

import { Section } from "@/components/content/section";
import {
  MetricCard,
  MetricCardGroup,
  MetricCardHeader,
  MetricCardTitle,
  MetricCardValue,
} from "@/components/metric/metric-card";
import {
  EmptyStateContainer,
  EmptyStateTitle,
} from "@/components/content/empty-state";
import { Button } from "@/components/ui/button";
import { List, Plus, Search } from "lucide-react";
import { DataTable } from "@/components/ui/data-table/data-table";
import { incidents } from "@/data/incidents";
import { columns } from "@/components/data-table/incidents/columns";
import { FormSheetStatusReport } from "@/components/forms/status-report/sheet";
import { FormSheetMaintenance } from "@/components/forms/maintenance/sheet";
import { monitors } from "@/data/monitors";
import { statusPages } from "@/data/status-pages";
import Link from "next/link";

const metrics = [
  {
    title: "Total Monitors",
    value: monitors.length,
    href: "/dashboard/monitors",
    variant: "default" as const,
    icon: List,
  },
  {
    title: "Total Status Pages",
    value: statusPages.length,
    href: "/dashboard/status-pages",
    variant: "default" as const,
    icon: List,
  },
  {
    title: "Last Incident",
    value: "1 day ago",
    href: "/dashboard/monitors/incidents",
    variant: "default" as const,
    icon: Search,
  },
  {
    title: "Last Report",
    value: "35 days ago",
    href: "/dashboard/status-pages/status-reports",
    variant: "default" as const,
    icon: Search,
  },
  {
    title: "Last Maintenance",
    value: "None",
    href: "/dashboard/status-pages/maintenances",
    variant: "default" as const,
    icon: Search,
  },
];

export default function Page() {
  return (
    <SectionGroup>
      <Section>
        <SectionHeader>
          <SectionTitle>Overview</SectionTitle>
          <SectionDescription>
            Welcome to your OpenStatus dashboard.
          </SectionDescription>
        </SectionHeader>
        <MetricCardGroup>
          {metrics.map((metric) => (
            <Link href={metric.href} key={metric.title}>
              <MetricCard variant={metric.variant}>
                <MetricCardHeader className="flex justify-between items-center gap-2">
                  <MetricCardTitle className="truncate">
                    {metric.title}
                  </MetricCardTitle>
                  <metric.icon className="size-4" />
                </MetricCardHeader>
                <MetricCardValue>{metric.value}</MetricCardValue>
              </MetricCard>
            </Link>
          ))}
        </MetricCardGroup>
      </Section>
      <Section>
        <SectionHeader>
          <SectionTitle>Incidents</SectionTitle>
          <SectionDescription>
            Incidents over the last 30 days.
          </SectionDescription>
        </SectionHeader>
        <DataTable columns={columns} data={incidents} />
      </Section>
      <Section>
        <SectionHeaderRow>
          <SectionHeader>
            <SectionTitle>Reports</SectionTitle>
            <SectionDescription>
              Reports over the last 30 days.
            </SectionDescription>
          </SectionHeader>
          {/* Should be FormSheetStatusReport **NOT** -Update */}
          <div>
            <FormSheetStatusReport>
              <Button data-section="action" size="sm" variant="ghost">
                <Plus />
                Create
              </Button>
            </FormSheetStatusReport>
          </div>
        </SectionHeaderRow>
        <EmptyStateContainer>
          <EmptyStateTitle>No reports found</EmptyStateTitle>
        </EmptyStateContainer>
      </Section>
      <Section>
        <SectionHeaderRow>
          <SectionHeader>
            <SectionTitle>Maintenance</SectionTitle>
            <SectionDescription>
              Maintenance over the last 30 days.
            </SectionDescription>
          </SectionHeader>
          <div>
            <FormSheetMaintenance>
              <Button data-section="action" size="sm" variant="ghost">
                <Plus />
                Create
              </Button>
            </FormSheetMaintenance>
          </div>
        </SectionHeaderRow>
        <EmptyStateContainer>
          <EmptyStateTitle>No maintenances found</EmptyStateTitle>
        </EmptyStateContainer>
      </Section>
    </SectionGroup>
  );
}
