"use client";

import { Tabs, TabsList, TabsTrigger } from "@openstatus/ui/components/ui/tabs";
import { useMemo, useState } from "react";

import {
  Section,
  SectionDescription,
  SectionGroup,
  SectionHeader,
  SectionHeaderRow,
  SectionTitle,
} from "@/components/content/section";
import { getColumns } from "@/components/data-table/status-page-history/columns";
import { getColumnVisibility } from "@/components/data-table/status-page-history/data";
import { mockRows } from "@/components/data-table/status-page-history/mock";
import { UptimeExplainer } from "@/components/data-table/status-page-history/uptime-explainer";
import {
  MetricCard,
  MetricCardGroup,
  MetricCardHeader,
  MetricCardTitle,
  MetricCardValue,
} from "@/components/metric/metric-card";
import { DataTable } from "@/components/ui/data-table/data-table";

export default function Page() {
  const [window, setWindow] = useState<6 | 12 | 24>(6);

  const columns = useMemo(() => getColumns(window), [window]);
  const columnVisibility = useMemo(() => getColumnVisibility(window), [window]);

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
              onValueChange={(v) => setWindow(Number(v) as 6 | 12 | 24)}
            >
              <TabsList>
                <TabsTrigger value="6">6 months</TabsTrigger>
                <TabsTrigger value="12">12 months</TabsTrigger>
                <TabsTrigger value="24">24 months</TabsTrigger>
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
            <MetricCardValue>99.96%</MetricCardValue>
          </MetricCard>
          <MetricCard>
            <MetricCardHeader>
              <MetricCardTitle className="uppercase">Incidents</MetricCardTitle>
            </MetricCardHeader>
            <MetricCardValue>8</MetricCardValue>
          </MetricCard>
          <MetricCard>
            <MetricCardHeader>
              <MetricCardTitle className="uppercase">
                Components
              </MetricCardTitle>
            </MetricCardHeader>
            <MetricCardValue>8</MetricCardValue>
          </MetricCard>
          <MetricCard>
            <MetricCardHeader>
              <MetricCardTitle className="uppercase">
                Oldest Record
              </MetricCardTitle>
            </MetricCardHeader>
            <MetricCardValue>Jul '25</MetricCardValue>
          </MetricCard>
        </MetricCardGroup>
        <div className="overflow-x-auto">
          <DataTable
            columns={columns}
            data={mockRows}
            columnVisibility={columnVisibility}
            defaultPagination={{ pageIndex: 0, pageSize: 100 }}
          />
        </div>
        <UptimeExplainer />
      </Section>
    </SectionGroup>
  );
}
