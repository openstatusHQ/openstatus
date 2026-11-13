"use client";

import type { RouterOutputs } from "@openstatus/api";
import { Lock, Shield } from "@openstatus/icons";
import { Button } from "@openstatus/ui/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@openstatus/ui/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@openstatus/ui/components/ui/tooltip";
import { useQuery } from "@tanstack/react-query";
import { useQueryState } from "nuqs";
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
import { columns } from "@/components/data-table/monitor-reportings/columns";
import { UpgradeDialog } from "@/components/dialogs/upgrade";
import { FormSheetMonitorReportingCreate } from "@/components/forms/monitor-reporting/sheet-create";
import { SlaMonthStripLegend } from "@/components/reportings/sla-month-strip";
import { DataTable } from "@/components/ui/data-table/data-table";
import { DataTableEmpty } from "@/components/ui/data-table/data-table-empty";
import { DataTablePaginationSimple } from "@/components/ui/data-table/data-table-pagination";
import { useTRPC } from "@/lib/trpc/client";

import { VIEWS, searchParamsParsers } from "./search-params";

type Policy = RouterOutputs["monitorReporting"]["list"][number];

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
  liveMonth: "2026-01-01",
  liveTerms: { target: Number(target), strict: false },
  pendingTerms: null,
  timeZone: "UTC",
  archivedAt: null,
  sealed: true,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  monitors: [EXAMPLE_MONITOR],
})) satisfies Policy[];

export function Client() {
  const trpc = useTRPC();
  const [openDialog, setOpenDialog] = useState(false);
  const [view, setView] = useQueryState("view", searchParamsParsers.view);
  const archived = view === "archived";
  const { data: workspace } = useQuery(trpc.workspace.get.queryOptions());
  const userQuery = useQuery(trpc.user.get.queryOptions());
  const membersQuery = useQuery(trpc.member.list.queryOptions());
  const allowed = workspace?.limits["monitor-sla"] === true;
  const { data: policies } = useQuery({
    ...trpc.monitorReporting.list.queryOptions({ archived }),
    enabled: allowed,
  });
  const { data: monitors } = useQuery({
    ...trpc.monitor.list.queryOptions(),
    enabled: allowed,
  });

  if (!workspace) return null;

  const role = membersQuery.data?.find(
    (m) => m.user.id === userQuery.data?.id,
  )?.role;
  const canEdit = role === "owner" || role === "admin";
  const roleError = userQuery.isError || membersQuery.isError;
  const roleLoading = !roleError && (!userQuery.data || !membersQuery.data);
  const disabledCreate = (
    <Button data-section="action" size="sm" disabled>
      Create reporting
    </Button>
  );
  const create = roleLoading ? (
    disabledCreate
  ) : !canEdit ? (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* a disabled button gets no pointer events, so the wrapper takes the hover */}
        <span tabIndex={0} className="inline-flex">
          {disabledCreate}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        {roleError
          ? "Could not check your role. Reload to try again."
          : "Only owners and admins can create a reporting."}
      </TooltipContent>
    </Tooltip>
  ) : (
    <FormSheetMonitorReportingCreate monitors={monitors ?? []}>
      <Button data-section="action" size="sm">
        Create reporting
      </Button>
    </FormSheetMonitorReportingCreate>
  );

  return (
    <SectionGroup>
      <Section id="reportings">
        <SectionHeaderRow>
          <SectionHeader>
            <SectionTitle>Reportings</SectionTitle>
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
                Create reporting
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
                    <EmptyStateTitle>No archived reportings</EmptyStateTitle>
                    <EmptyStateDescription>
                      A reporting with sealed months is archived instead of
                      deleted, and kept here read-only.
                    </EmptyStateDescription>
                  </DataTableEmpty>
                ) : (
                  <DataTableEmpty>
                    <EmptyStateMedia>
                      <Shield />
                    </EmptyStateMedia>
                    <EmptyStateTitle>No reportings</EmptyStateTitle>
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
        {!allowed || (policies && policies.length > 0) ? (
          <SlaMonthStripLegend>
            <span>
              A month is missed when any monitor in the reporting missed it.
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
