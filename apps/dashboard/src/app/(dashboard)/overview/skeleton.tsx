import { Skeleton } from "@openstatus/ui/components/ui/skeleton";

import {
  SectionDescription,
  SectionGroup,
  SectionHeader,
  SectionTitle,
} from "@/components/content/section";
import { Section } from "@/components/content/section";
import {
  MetricCard,
  MetricCardGroup,
  MetricCardHeader,
  MetricCardTitle,
} from "@/components/metric/metric-card";
import { DataTableSkeleton } from "@/components/ui/data-table/data-table-skeleton";

const METRIC_COUNT = 5;

/**
 * Mirrors the section/card structure of `page.tsx` so the streamed shell and
 * the loaded page occupy the same space — a smaller placeholder would shift
 * the layout on hydration.
 */
export function OverviewSkeleton() {
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
          {Array.from({ length: METRIC_COUNT }).map((_, i) => (
            <MetricCard key={i}>
              <MetricCardHeader className="flex items-center justify-between gap-2">
                <MetricCardTitle className="truncate">
                  <Skeleton className="h-4 w-24" />
                </MetricCardTitle>
                <Skeleton className="size-4 shrink-0" />
              </MetricCardHeader>
              <Skeleton className="h-8 w-12" />
            </MetricCard>
          ))}
        </MetricCardGroup>
      </Section>
      <Section>
        <SectionHeader>
          <SectionTitle>Needs Attention</SectionTitle>
          <SectionDescription>
            Everything currently unresolved, newest first.
          </SectionDescription>
        </SectionHeader>
        <DataTableSkeleton />
      </Section>
      <Section>
        <SectionHeader>
          <SectionTitle>Recent Activity</SectionTitle>
          <SectionDescription>
            Resolved incidents and reports, and completed maintenances from the
            last 7 days.
          </SectionDescription>
        </SectionHeader>
        <DataTableSkeleton />
      </Section>
    </SectionGroup>
  );
}
