import {
  SectionDescription,
  SectionGroup,
  SectionHeader,
  SectionHeaderRow,
  SectionTitle,
} from "@/components/content/section";

import {
  EmptyStateContainer,
  EmptyStateTitle,
} from "@/components/content/empty-state";
import { Section } from "@/components/content/section";
import { columns } from "@/components/data-table/incidents/columns";
import { FormSheetMaintenance } from "@/components/forms/maintenance/sheet";
import { FormSheetStatusReport } from "@/components/forms/status-report/sheet";
import {
  MetricCard,
  MetricCardGroup,
  MetricCardHeader,
  MetricCardTitle,
  MetricCardValue,
} from "@/components/metric/metric-card";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table/data-table";
import { incidents } from "@/data/incidents";
import { List, Plus, Search } from "lucide-react";
import Link from "next/link";
import { getQueryClient, HydrateClient, trpc } from "@/lib/trpc/server";

export default async function Page() {
  const queryClient = getQueryClient();

  const monitors = await queryClient.fetchQuery(
    trpc.monitor.list.queryOptions()
  );
  const pages = await queryClient.fetchQuery(trpc.page.list.queryOptions());

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
      value: pages.length,
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

  return (
    <HydrateClient>
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
                  <MetricCardHeader className="flex items-center justify-between gap-2">
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
    </HydrateClient>
  );
}
