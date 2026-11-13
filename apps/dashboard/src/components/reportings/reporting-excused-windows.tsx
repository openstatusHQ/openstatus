"use client";

import type { RouterOutputs } from "@openstatus/api";
import { Shield } from "@openstatus/icons";
import { Button } from "@openstatus/ui/components/ui/button";
import { useMemo } from "react";

import {
  EmptyStateDescription,
  EmptyStateMedia,
  EmptyStateTitle,
} from "@/components/content/empty-state";
import {
  Section,
  SectionDescription,
  SectionHeader,
  SectionHeaderRow,
  SectionTitle,
} from "@/components/content/section";
import { getColumns } from "@/components/data-table/monitor-sla-excused-windows/columns";
import { DataTable } from "@/components/ui/data-table/data-table";
import { DataTableEmpty } from "@/components/ui/data-table/data-table-empty";

type Policy = RouterOutputs["monitorSlaPolicy"]["get"];

export function SlaPolicyExcusedWindows({
  policy,
  canEdit,
  onAdd,
}: {
  policy: Policy;
  /** owners and admins; members see the windows read-only */
  canEdit: boolean;
  onAdd: () => void;
}) {
  const archived = policy.archivedAt !== null;
  const readOnly = archived || !canEdit;
  const { timeZone } = policy;
  const columns = useMemo(
    () => getColumns({ readOnly, timeZone }),
    [readOnly, timeZone],
  );
  const windows = policy.excusedWindows;

  return (
    <Section id="excused">
      <SectionHeaderRow>
        <SectionHeader>
          <SectionTitle>
            Excused downtime
            <span className="text-muted-foreground ml-2 font-mono text-xs font-normal">
              {windows.length}
            </span>
          </SectionTitle>
          <SectionDescription>
            Checks inside these windows are left out of both sides of the month
            for every monitor in the policy; overlapping windows excuse a check
            once. A window is locked once a month it touches is sealed, or is
            older than the previous month.
          </SectionDescription>
        </SectionHeader>
        {readOnly ? null : (
          <div>
            <Button size="sm" variant="outline" onClick={onAdd}>
              Add window
            </Button>
          </div>
        )}
      </SectionHeaderRow>
      {/* the page size is read on mount: remount so a new window is not paged out */}
      <DataTable
        key={windows.length}
        columns={columns}
        data={windows}
        defaultPagination={{ pageIndex: 0, pageSize: windows.length || 1 }}
        emptyState={
          <DataTableEmpty>
            <EmptyStateMedia>
              <Shield />
            </EmptyStateMedia>
            <EmptyStateTitle>No excused downtime</EmptyStateTitle>
            <EmptyStateDescription>
              Every check counts toward the month.
            </EmptyStateDescription>
          </DataTableEmpty>
        }
      />
      {!archived && policy.excusedExpired ? (
        <p className="text-warning text-sm">
          Some months not sealed are shown without their excused windows: the
          checks inside them are older than 45 days and can no longer be
          counted.
        </p>
      ) : null}
    </Section>
  );
}
