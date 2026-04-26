"use client";

import { Link } from "@/components/common/link";
import {
  BillingOverlay,
  BillingOverlayButton,
  BillingOverlayContainer,
  BillingOverlayDescription,
} from "@/components/content/billing-overlay";
import {
  EmptyStateContainer,
  EmptyStateDescription,
  EmptyStateTitle,
} from "@/components/content/empty-state";
import {
  Section,
  SectionDescription,
  SectionGroup,
  SectionHeader,
  SectionTitle,
} from "@/components/content/section";
import { columns } from "@/components/data-table/audit-logs-workspace/columns";
import { DataTableRowDetails } from "@/components/data-table/audit-logs-workspace/data-table-row-details";
import { UpgradeDialog } from "@/components/dialogs/upgrade";
import { DataTable } from "@/components/ui/data-table/data-table";
import { DataTablePaginationSimple } from "@/components/ui/data-table/data-table-pagination";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@openstatus/api";
import { useQuery } from "@tanstack/react-query";
import { Lock } from "lucide-react";
import { useState } from "react";

type AuditLog = RouterOutputs["auditLog"]["list"]["items"][number];

const EXAMPLES = [
  {
    id: 1,
    workspaceId: 1,
    actorType: "user",
    actorId: "42",
    actorUserId: 42,
    action: "monitor.update",
    entityType: "monitor",
    entityId: "101",
    before: null,
    after: null,
    metadata: null,
    changedFields: ["name", "url"],
    createdAt: new Date("2026-04-24T10:00:00Z"),
    user: {
      id: 42,
      name: "Maximilian Kaske",
      email: "m@openstatus.dev",
      photoUrl: null,
    },
  },
  {
    id: 2,
    workspaceId: 1,
    actorType: "user",
    actorId: "42",
    actorUserId: 42,
    action: "page.create",
    entityType: "page",
    entityId: "7",
    before: null,
    after: null,
    metadata: null,
    changedFields: null,
    createdAt: new Date("2026-04-23T16:30:00Z"),
    user: {
      id: 42,
      name: "Thibault Le Ouay Ducasse",
      email: "t@openstatus.dev",
      photoUrl: null,
    },
  },
  {
    id: 3,
    workspaceId: 1,
    actorType: "slack",
    actorId: "k_abc123",
    actorUserId: null,
    action: "status_report.create",
    entityType: "status_report",
    entityId: "12",
    before: null,
    after: null,
    metadata: null,
    changedFields: null,
    createdAt: new Date("2026-04-22T09:15:00Z"),
    user: null,
  },
] satisfies AuditLog[];

export function Client() {
  const trpc = useTRPC();
  const [openDialog, setOpenDialog] = useState(false);
  const { data: workspace } = useQuery(trpc.workspace.get.queryOptions());
  const { data: auditLogs } = useQuery(trpc.auditLog.list.queryOptions({}));

  if (!workspace) return null;

  const isLimited = workspace.limits["audit-log"] === false;

  return (
    <SectionGroup>
      <SectionHeader>
        <SectionTitle>Audit Logs</SectionTitle>
        <SectionDescription>
          Track mutating actions taken against your workspace from the last 14
          days.
        </SectionDescription>
      </SectionHeader>
      <Section>
        {isLimited ? (
          <BillingOverlayContainer>
            <DataTable
              columns={columns}
              data={[...EXAMPLES, ...EXAMPLES, ...EXAMPLES]}
              rowComponent={({ row }) => (
                <DataTableRowDetails row={row.original} />
              )}
            />
            <BillingOverlay>
              <BillingOverlayButton onClick={() => setOpenDialog(true)}>
                <Lock />
                Upgrade
              </BillingOverlayButton>
              <BillingOverlayDescription>
                Keep a verifiable history of every change in your workspace.{" "}
                <Link
                  href="https://docs.openstatus.dev/"
                  rel="noreferrer"
                  target="_blank"
                >
                  Learn more
                </Link>
                .
              </BillingOverlayDescription>
            </BillingOverlay>
            <UpgradeDialog
              open={openDialog}
              onOpenChange={setOpenDialog}
              limit="audit-log"
            />
          </BillingOverlayContainer>
        ) : auditLogs?.items.length ? (
          <DataTable
            columns={columns}
            data={auditLogs.items}
            onRowClick={(row) =>
              row.getCanExpand() ? row.toggleExpanded() : undefined
            }
            rowComponent={({ row }) => (
              <DataTableRowDetails row={row.original} />
            )}
            paginationComponent={DataTablePaginationSimple}
          />
        ) : (
          <EmptyStateContainer>
            <EmptyStateTitle>No audit logs</EmptyStateTitle>
            <EmptyStateDescription>
              Actions taken in this workspace will appear here.
            </EmptyStateDescription>
          </EmptyStateContainer>
        )}
      </Section>
    </SectionGroup>
  );
}
