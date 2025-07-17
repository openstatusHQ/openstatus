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
import { formatDistanceToNowStrict } from "date-fns";
import { cn } from "@/lib/utils";
import { DataTableStatusReports } from "./data-table-status-reports";
import { Note, NoteButton, NoteIcon } from "@/components/common/note";
import { Terminal } from "lucide-react";

// FIXME: the page is server side
// whenever I change the maintenances, the page is not updated
// we need to move the queryClient to the layout and prefetch the data there

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
        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
      },
    })
  );
  const statusReports = await queryClient.fetchQuery(
    trpc.statusReport.list.queryOptions({
      order: "desc",
      createdAt: {
        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
      },
    })
  );
  const maintenances = await queryClient.fetchQuery(
    trpc.maintenance.list.queryOptions({
      order: "desc",
      createdAt: {
        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
      },
    })
  );

  const lastIncident = incidents.length > 0 ? incidents[0] : null;
  const lastStatusReport = statusReports.length > 0 ? statusReports[0] : null;
  const lastMaintenance = maintenances.length > 0 ? maintenances[0] : null;

  const incidentDistance = lastIncident
    ? formatDistanceToNowStrict(lastIncident.startedAt, {
        addSuffix: true,
      })
    : "None";

  const statusReportDistance = lastStatusReport?.createdAt
    ? formatDistanceToNowStrict(lastStatusReport.createdAt, {
        addSuffix: true,
      })
    : "None";

  const maintenanceDistance = lastMaintenance?.createdAt
    ? formatDistanceToNowStrict(lastMaintenance.createdAt, {
        addSuffix: true,
      })
    : "None";

  const metrics = [
    {
      title: "Total Monitors",
      value: monitors.length,
      href: "/monitors",
      variant: "default" as const,
      icon: List,
    },
    {
      title: "Total Status Pages",
      value: pages.length,
      href: "/status-pages",
      variant: "default" as const,
      icon: List,
    },
    {
      title: "Recent Incident",
      value: incidentDistance,
      disabled: !lastIncident?.monitorId,
      href: `/monitors/${lastIncident?.monitorId}/incidents`,
      variant: "default" as const,
      icon: Search,
    },
    {
      title: "Last Report",
      value: statusReportDistance,
      disabled: !lastStatusReport?.pageId,
      href: `/status-pages/${lastStatusReport?.pageId}/status-reports`,
      variant: "default" as const,
      icon: Search,
    },
    {
      title: "Last Maintenance",
      value: maintenanceDistance,
      disabled: !lastMaintenance?.pageId,
      href: `/status-pages/${lastMaintenance?.pageId}/maintenances`,
      variant: "default" as const,
      icon: Search,
    },
  ];

  return (
    <HydrateClient>
      <SectionGroup>
        <Note>
          <NoteIcon>
            <Terminal className="size-4" />
          </NoteIcon>
          Use Monitoring as Code to manage your monitors with our CLI.
          <NoteButton variant="outline" asChild>
            <Link href="/cli">Learn more</Link>
          </NoteButton>
        </Note>
        <Section>
          <SectionHeader>
            <SectionTitle>Overview</SectionTitle>
            <SectionDescription>
              Welcome to your OpenStatus dashboard.
            </SectionDescription>
          </SectionHeader>
          <MetricCardGroup>
            {metrics.map((metric) => (
              <Link
                href={metric.href}
                key={metric.title}
                className={cn(metric.disabled && "pointer-events-none")}
                aria-disabled={metric.disabled}
              >
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
              Incidents over the last 7 days.
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
              Reports over the last 7 days.
            </SectionDescription>
          </SectionHeader>
          {statusReports.length > 0 ? (
            <DataTableStatusReports statusReports={statusReports} />
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
              Maintenance over the last 7 days.
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
