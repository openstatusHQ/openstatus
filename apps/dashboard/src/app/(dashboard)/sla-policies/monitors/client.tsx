"use client";

import type { RouterOutputs } from "@openstatus/api";
import { Lock, Shield } from "@openstatus/icons";
import { Button } from "@openstatus/ui/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@openstatus/ui/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useState } from "react";

import {
  BillingOverlay,
  BillingOverlayButton,
  BillingOverlayContainer,
  BillingOverlayDescription,
} from "@/components/content/billing-overlay";
import {
  EmptyStateActions,
  EmptyStateDescription,
  EmptyStateMedia,
  EmptyStateTitle,
} from "@/components/content/empty-state";
import {
  Section,
  SectionDescription,
  SectionGroup,
  SectionHeader,
  SectionHeaderRow,
  SectionTitle,
} from "@/components/content/section";
import { columns } from "@/components/data-table/monitor-sla-policies/columns";
import { UpgradeDialog } from "@/components/dialogs/upgrade";
import { FormSheetMonitorSlaPolicyCreate } from "@/components/forms/monitor-sla-policy/sheet-create";
import { SlaMonthStripLegend } from "@/components/sla-policies/sla-month-strip";
import { DataTable } from "@/components/ui/data-table/data-table";
import { DataTableEmpty } from "@/components/ui/data-table/data-table-empty";
import { DataTablePaginationSimple } from "@/components/ui/data-table/data-table-pagination";
import { useTRPC } from "@/lib/trpc/client";

type Policy = RouterOutputs["monitorSlaPolicy"]["list"][number];

const VIEWS = ["active", "archived"] as const;
const parseView = parseAsStringLiteral(VIEWS).withDefault("active");

const EXAMPLE_MONITOR = {
  id: 1,
  name: "API",
  url: "https://api.example.com",
  jobType: "http" as const,
};
const EXAMPLES = [
  ["Enterprise contract", 99_950],
  ["Partner API", 99_900],
  ["Customer portal", 99_500],
  ["Checkout", 99_990],
  ["Internal tools", 99_000],
  ["Status page commitment", 99_900],
].map(([name, target], i) => ({
  id: i + 1,
  months: Array.from({ length: 12 }, (_, m) => ({
    month: `2025-${String(m + 1).padStart(2, "0")}-01`,
    status: m === 3 + i ? ("missed" as const) : ("met" as const),
    preview: m < 4,
  })),
  missed: { months: 1, previews: i === 0 ? 1 : 0, of: 12 },
  workspaceId: 1,
  name: String(name),
  target: Number(target),
  strict: false,
  archivedAt: null,
  sealed: true,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  monitors: [EXAMPLE_MONITOR],
})) satisfies Policy[];

export function Client() {
  const trpc = useTRPC();
  const [openDialog, setOpenDialog] = useState(false);
  const [view, setView] = useQueryState("view", parseView);
  const archived = view === "archived";
  const { data: workspace } = useQuery(trpc.workspace.get.queryOptions());
  const { data: user } = useQuery(trpc.user.get.queryOptions());
  const { data: members } = useQuery(trpc.member.list.queryOptions());
  const allowed = workspace?.limits["monitor-sla"] === true;
  const { data: policies } = useQuery({
    ...trpc.monitorSlaPolicy.list.queryOptions({ archived }),
    enabled: allowed,
  });
  const { data: monitors } = useQuery({
    ...trpc.monitor.list.queryOptions(),
    enabled: allowed,
  });

  if (!workspace) return null;

  const role = members?.find((m) => m.user.id === user?.id)?.role;
  const canEdit = role === "owner" || role === "admin";
  const create = !canEdit ? (
    <Button
      data-section="action"
      size="sm"
      disabled
      title="Only owners and admins can create a policy."
    >
      Create policy
    </Button>
  ) : (
    <FormSheetMonitorSlaPolicyCreate monitors={monitors ?? []}>
      <Button data-section="action" size="sm">
        Create policy
      </Button>
    </FormSheetMonitorSlaPolicyCreate>
  );

  return (
    <SectionGroup>
      <Section id="sla-policies">
        <SectionHeaderRow>
          <SectionHeader>
            <SectionTitle>SLA policies</SectionTitle>
            <SectionDescription>
              The uptime you committed to, judged per monitor and month.
            </SectionDescription>
          </SectionHeader>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {allowed ? (
              <Tabs
                value={view}
                onValueChange={(v) => setView(v === "archived" ? v : null)}
              >
                <TabsList>
                  {VIEWS.map((v) => (
                    <TabsTrigger key={v} value={v} className="capitalize">
                      {v}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            ) : null}
            {allowed ? (
              create
            ) : (
              <Button
                data-section="action"
                data-track="paywall_viewed"
                data-limit="monitor-sla"
                size="sm"
                onClick={() => setOpenDialog(true)}
              >
                <Lock />
                Create policy
              </Button>
            )}
          </div>
        </SectionHeaderRow>
        {allowed ? (
          policies ? (
            <DataTable
              paginationComponent={DataTablePaginationSimple}
              columns={columns}
              data={policies}
              emptyState={
                archived ? (
                  <DataTableEmpty>
                    <EmptyStateMedia>
                      <Shield />
                    </EmptyStateMedia>
                    <EmptyStateTitle>No archived policies</EmptyStateTitle>
                    <EmptyStateDescription>
                      A policy with sealed months is archived instead of
                      deleted, and kept here read-only.
                    </EmptyStateDescription>
                  </DataTableEmpty>
                ) : (
                  <DataTableEmpty>
                    <EmptyStateMedia>
                      <Shield />
                    </EmptyStateMedia>
                    <EmptyStateTitle>No SLA policies</EmptyStateTitle>
                    <EmptyStateDescription>
                      Set a monthly uptime target for the monitors a contract
                      covers. Each monitor is judged against it month by month.
                    </EmptyStateDescription>
                    <EmptyStateActions>{create}</EmptyStateActions>
                  </DataTableEmpty>
                )
              }
            />
          ) : null
        ) : (
          <BillingOverlayContainer>
            <DataTable columns={columns} data={EXAMPLES} />
            <BillingOverlay>
              <BillingOverlayButton
                data-track="paywall_viewed"
                data-limit="monitor-sla"
                onClick={() => setOpenDialog(true)}
              >
                <Lock />
                Upgrade
              </BillingOverlayButton>
              <BillingOverlayDescription>
                Track the monthly uptime you committed to in a contract, per
                monitor.
              </BillingOverlayDescription>
            </BillingOverlay>
          </BillingOverlayContainer>
        )}
        {policies && policies.length > 0 ? (
          <SlaMonthStripLegend>
            <span>
              A month is missed when any monitor in the policy missed it.
            </span>
          </SlaMonthStripLegend>
        ) : null}
        <UpgradeDialog
          open={openDialog}
          onOpenChange={setOpenDialog}
          limit="monitor-sla"
        />
      </Section>
    </SectionGroup>
  );
}
