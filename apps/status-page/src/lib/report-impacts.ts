import type { StatusReportImpact } from "@openstatus/ui/components/blocks/status.types";

type ReportWithImpactRows<U> = {
  statusReportsToPageComponents: {
    pageComponent: { id: number; name: string };
  }[];
  statusReportUpdates: U[];
};

/**
 * Maps a report's update impact rows to the `impactChanges` shape consumed by
 * the timeline blocks, resolving component names from the report associations.
 */
export function updatesWithImpactChanges<
  U extends {
    statusReportUpdateToPageComponents: {
      pageComponentId: number;
      impact: StatusReportImpact;
    }[];
  },
>(report: ReportWithImpactRows<U>) {
  const nameById = new Map(
    report.statusReportsToPageComponents.map((a) => [
      a.pageComponent.id,
      a.pageComponent.name,
    ]),
  );
  return report.statusReportUpdates.map((update) => ({
    ...update,
    impactChanges: update.statusReportUpdateToPageComponents.map((ci) => ({
      name: nameById.get(ci.pageComponentId) ?? `#${ci.pageComponentId}`,
      impact: ci.impact,
    })),
  }));
}
