"use client";

import { Button } from "@openstatus/ui/components/ui/button";
import { useQuery } from "@tanstack/react-query";

import { toLocalInput } from "@/components/forms/incident/form";
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
  // A report can belong to one incident; declaring another would fail on submit.
  const { data: incidents } = useQuery({
    ...trpc.incident.list.queryOptions(),
    enabled: statusReportId !== undefined,
  });
  if (incidents?.some((i) => i.statusReport?.id === statusReportId)) {
    return null;
  }
  return (
    <DeclareIncidentButton
      source={source}
      defaultValues={{
        title,
        // epoch = legacy report without dates; prefill now instead
        startedAt: toLocalInput(
          startedAt.getTime() === 0 ? new Date() : startedAt,
        ),
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
