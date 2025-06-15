import {
  SectionDescription,
  SectionGroup,
  SectionHeader,
  SectionTitle,
} from "@/components/content/section";

import {
  EmptyStateContainer,
  EmptyStateTitle,
} from "@/components/content/empty-state";
import { Section } from "@/components/content/section";
import { columns as incidentsColumns } from "@/components/data-table/incidents/columns";
import { columns as statusReportsColumns } from "@/components/data-table/status-reports/columns";
import { columns as maintenancesColumns } from "@/components/data-table/maintenances/columns";
import {
  MetricCard,
  MetricCardGroup,
  MetricCardHeader,
  MetricCardTitle,
  MetricCardValue,
} from "@/components/metric/metric-card";
import { DataTable } from "@/components/ui/data-table/data-table";
import { List, Search } from "lucide-react";
import Link from "next/link";
import { getQueryClient, HydrateClient, trpc } from "@/lib/trpc/server";
import { formatDistanceToNow } from "date-fns";

export default async function Page() {
  const queryClient = getQueryClient();

  const monitors = await queryClient.fetchQuery(
    trpc.monitor.list.queryOptions()
  );
  const pages = await queryClient.fetchQuery(trpc.page.list.queryOptions());
  const incidents = await queryClient.fetchQuery(
    trpc.incident.list.queryOptions({
      order: "desc",
      startedAt: {
        gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      },
    })
  );
  const statusReports = await queryClient.fetchQuery(
    trpc.statusReport.list.queryOptions({
      order: "desc",
      createdAt: {
        gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      },
    })
  );
  const maintenances = await queryClient.fetchQuery(
    trpc.maintenance.list.queryOptions({
      order: "desc",
      createdAt: {
        gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      },
    })
  );

  const lastIncident = incidents.length > 0 ? incidents[0] : null;
  const lastStatusReport = statusReports.length > 0 ? statusReports[0] : null;
  const lastMaintenance = maintenances.length > 0 ? maintenances[0] : null;

  const incidentDistance = lastIncident
    ? formatDistanceToNow(lastIncident.startedAt, {
        addSuffix: true,
      })
    : "None";

  const statusReportDistance = lastStatusReport?.createdAt
    ? formatDistanceToNow(lastStatusReport.createdAt, {
        addSuffix: true,
      })
    : "None";

  const maintenanceDistance = lastMaintenance?.createdAt
    ? formatDistanceToNow(lastMaintenance.createdAt, {
        addSuffix: true,
      })
    : "None";

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
      title: "Recent Incident",
      value: incidentDistance,
      href: "/dashboard/monitors/incidents",
      variant: "default" as const,
      icon: Search,
    },
    {
      title: "Last Report",
      value: statusReportDistance,
      href: "/dashboard/status-pages/status-reports",
      variant: "default" as const,
      icon: Search,
    },
    {
      title: "Last Maintenance",
      value: maintenanceDistance,
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
          {incidents.length > 0 ? (
            <DataTable columns={incidentsColumns} data={incidents} />
          ) : (
            <EmptyStateContainer>
              <EmptyStateTitle>No incidents found</EmptyStateTitle>
            </EmptyStateContainer>
          )}
        </Section>
        <Section>
          <SectionHeader>
            <SectionTitle>Reports</SectionTitle>
            <SectionDescription>
              Reports over the last 30 days.
            </SectionDescription>
          </SectionHeader>
          {statusReports.length > 0 ? (
            <DataTable columns={statusReportsColumns} data={statusReports} />
          ) : (
            <EmptyStateContainer>
              <EmptyStateTitle>No reports found</EmptyStateTitle>
            </EmptyStateContainer>
          )}
        </Section>
        <Section>
          <SectionHeader>
            <SectionTitle>Maintenance</SectionTitle>
            <SectionDescription>
              Maintenance over the last 30 days.
            </SectionDescription>
          </SectionHeader>
          {maintenances.length > 0 ? (
            <DataTable columns={maintenancesColumns} data={maintenances} />
          ) : (
            <EmptyStateContainer>
              <EmptyStateTitle>No maintenances found</EmptyStateTitle>
            </EmptyStateContainer>
          )}
        </Section>
      </SectionGroup>
    </HydrateClient>
  );
}
