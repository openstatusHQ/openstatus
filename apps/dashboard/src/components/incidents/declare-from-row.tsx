"use client";

import { Button } from "@openstatus/ui/components/ui/button";
import { useQuery } from "@tanstack/react-query";

import { useFeature } from "@/hooks/use-feature";
import { useTRPC } from "@/lib/trpc/client";

import {
  DeclareIncidentButton,
  type DeclareSource,
} from "./declare-incident-button";

/** "Declare" quick action on a downtime or status-report row, prefilled from it. */
export function DeclareFromRow({
  title,
  startedAt,
  source,
  statusReportId,
}: {
  title: string;
  startedAt: Date;
  source: DeclareSource;
  statusReportId?: number;
}) {
  const trpc = useTRPC();
  const enabled = useFeature("incident-management");
  // A report can belong to one incident; declaring another would fail on submit.
  const { data: incidents } = useQuery({
    ...trpc.incident.list.queryOptions(),
    enabled: enabled && statusReportId !== undefined,
  });
  if (!enabled) return null;
  if (incidents?.some((i) => i.statusReport?.id === statusReportId)) {
    return null;
  }
  return (
    <DeclareIncidentButton
      source={source}
      defaultValues={{
        title,
        // epoch = legacy report without dates; prefill now instead
        startedAt: startedAt.getTime() === 0 ? new Date() : startedAt,
        ...(statusReportId ? { statusReportId: String(statusReportId) } : {}),
      }}
    >
      <Button
        variant="outline"
        size="sm"
        className="h-7"
        onClick={(e) => e.stopPropagation()}
      >
        Declare
      </Button>
    </DeclareIncidentButton>
  );
}
