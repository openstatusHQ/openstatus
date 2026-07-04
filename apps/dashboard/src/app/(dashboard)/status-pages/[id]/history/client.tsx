"use client";

import { Tabs, TabsList, TabsTrigger } from "@openstatus/ui/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Info, Lock } from "lucide-react";
import { useParams } from "next/navigation";
import { useQueryStates } from "nuqs";
import { useMemo, useState } from "react";

import { NoteButton } from "@/components/common/note";
import { NoteDismissible } from "@/components/common/note-dismissible";
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
  HintCollapsible,
  HintCollapsibleContent,
  HintCollapsibleDescription,
  HintCollapsibleTitle,
  HintCollapsibleTrigger,
} from "@/components/content/hint-collapsible";
import {
  Section,
  SectionDescription,
  SectionGroup,
  SectionHeader,
  SectionHeaderRow,
  SectionTitle,
} from "@/components/content/section";
import { getColumns } from "@/components/data-table/status-page-history/columns";
import { UpgradeDialog } from "@/components/dialogs/upgrade";
import { FormDialogSupportContact } from "@/components/forms/support-contact/dialog";
import {
  MetricCard,
  MetricCardGroup,
  MetricCardHeader,
  MetricCardTitle,
  MetricCardValue,
} from "@/components/metric/metric-card";
import { DataTable } from "@/components/ui/data-table/data-table";
import {
  HISTORY_WINDOWS,
  getColumnVisibility,
  parseWindow,
  windowKey,
} from "@/data/status-page-history";
import { useTRPC } from "@/lib/trpc/client";

import { buildExampleHistory } from "./examples";
import { searchParamsParsers } from "./search-params";

export function Client() {
  const { id } = useParams<{ id: string }>();
  const trpc = useTRPC();
  const [{ window }, setSearchParams] = useQueryStates(searchParamsParsers);
  const [openDialog, setOpenDialog] = useState(false);

  const { data: workspace } = useQuery(trpc.workspace.get.queryOptions());
  const isLimited = workspace?.limits["uptime-history"] === false;

  // one 24-month fetch; the window tabs only toggle column visibility
  const { data: liveHistory } = useQuery({
    ...trpc.page.getUptimeHistory.queryOptions({ id: Number.parseInt(id) }),
    enabled: !!workspace && !isLimited,
  });

  const exampleHistory = useMemo(
    () => (isLimited ? buildExampleHistory() : null),
    [isLimited],
  );
  const history = isLimited ? exampleHistory : liveHistory;

  const columns = useMemo(
    () => getColumns(history?.months ?? [], window),
    [history?.months, window],
  );
  const columnVisibility = useMemo(
    () => getColumnVisibility(window, history?.months.length ?? 0),
    [window, history?.months.length],
  );

  if (!history) return null;

  const summary = history.summary[windowKey(window)];
  const hasAnyData = history.rows.some((row) =>
    Object.values(row.months).some((value) => value !== null),
  );

  return (
    <SectionGroup>
      <Section>
        <SectionHeader>
          <SectionHeaderRow>
            <div>
              <SectionTitle>History</SectionTitle>
              <SectionDescription>
                Long-term uptime, build from your page's components.
              </SectionDescription>
            </div>
            <Tabs
              value={String(window)}
              onValueChange={(v) => setSearchParams({ window: parseWindow(v) })}
            >
              <TabsList>
                {HISTORY_WINDOWS.map((w) => (
                  <TabsTrigger key={w} value={String(w)}>
                    {w} months
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </SectionHeaderRow>
        </SectionHeader>
      </Section>
      <Section>
        <MetricCardGroup className="md:grid-cols-4 lg:grid-cols-4">
          <MetricCard variant="success">
            <MetricCardHeader>
              <MetricCardTitle className="uppercase">
                Page Uptime
              </MetricCardTitle>
            </MetricCardHeader>
            <MetricCardValue>
              {summary.uptime === null ? "—" : `${summary.uptime.toFixed(2)}%`}
            </MetricCardValue>
          </MetricCard>
          <MetricCard>
            <MetricCardHeader>
              <MetricCardTitle className="uppercase">Reports</MetricCardTitle>
            </MetricCardHeader>
            <MetricCardValue>{summary.reports}</MetricCardValue>
          </MetricCard>
          <MetricCard>
            <MetricCardHeader>
              <MetricCardTitle className="uppercase">
                Components
              </MetricCardTitle>
            </MetricCardHeader>
            <MetricCardValue>{history.rows.length}</MetricCardValue>
          </MetricCard>
          <MetricCard>
            <MetricCardHeader>
              <MetricCardTitle className="uppercase">
                Created At
              </MetricCardTitle>
            </MetricCardHeader>
            <MetricCardValue>
              {history.createdAt ? format(history.createdAt, "MMM yy") : "—"}
            </MetricCardValue>
          </MetricCard>
        </MetricCardGroup>
        {isLimited ? (
          <BillingOverlayContainer>
            <div className="overflow-x-auto">
              <DataTable
                columns={columns}
                data={history.rows}
                columnVisibility={columnVisibility}
                defaultPagination={{ pageIndex: 0, pageSize: 100 }}
              />
            </div>
            <BillingOverlay>
              <BillingOverlayButton onClick={() => setOpenDialog(true)}>
                <Lock />
                Upgrade
              </BillingOverlayButton>
              <BillingOverlayDescription>
                Keep an overview of your uptime history for the last 24 months.
              </BillingOverlayDescription>
            </BillingOverlay>
            <UpgradeDialog
              open={openDialog}
              onOpenChange={setOpenDialog}
              limit="uptime-history"
            />
          </BillingOverlayContainer>
        ) : hasAnyData ? (
          <div className="overflow-x-auto">
            <DataTable
              columns={columns}
              data={history.rows}
              columnVisibility={columnVisibility}
              defaultPagination={{ pageIndex: 0, pageSize: 100 }}
            />
          </div>
        ) : (
          <EmptyStateContainer>
            <EmptyStateTitle>No history yet</EmptyStateTitle>
            <EmptyStateDescription>
              The first{" "}
              <span className="text-foreground font-medium">snapshot</span>{" "}
              freezes on the{" "}
              <span className="text-foreground font-medium">
                10th of next month
              </span>{" "}
              — until then, the current month is served live.
            </EmptyStateDescription>
          </EmptyStateContainer>
        )}
        <HintCollapsible>
          <HintCollapsibleTrigger>
            <HintCollapsibleTitle>
              How uptime is calculated
            </HintCollapsibleTitle>
            <HintCollapsibleDescription>
              Each percentage depends on the page's calculation mode and the
              component type.
            </HintCollapsibleDescription>
          </HintCollapsibleTrigger>
          <HintCollapsibleContent>
            <p className="text-muted-foreground">
              The calculation mode is set page-wide in the status page settings
              and applies to every month shown here. What is frozen monthly are
              the raw daily check counts — changing the mode re-renders all
              months from those immutable counts.
            </p>
            <ul className="space-y-2.5">
              <li>
                <span className="bg-muted rounded px-1 py-0.5 font-mono">
                  requests
                </span>{" "}
                <span className="text-muted-foreground">
                  — Monitor components. Uptime is{" "}
                  <span className="text-foreground font-medium">
                    (ok + degraded) / total checks
                  </span>
                  . Degraded responses still count as up.
                </span>
              </li>
              <li>
                <span className="bg-muted rounded px-1 py-0.5 font-mono">
                  duration
                </span>{" "}
                <span className="text-muted-foreground">
                  — Monitor components. Downtime is measured from incident and
                  status-report intervals, weighted by impact (major outage
                  counts fully, partial outage at half) and merged so
                  overlapping events are never double-counted.
                </span>
              </li>
              <li>
                <span className="bg-muted rounded px-1 py-0.5 font-mono">
                  manual
                </span>{" "}
                <span className="text-muted-foreground">
                  — No probe data is considered; uptime is derived entirely from
                  reported incidents. Static components always work this way,
                  with their full history kept — reports never expire.
                </span>
              </li>
            </ul>
            <p className="text-muted-foreground">
              Months without recorded checks are shown as{" "}
              <span className="text-foreground font-medium">no data</span> and
              excluded from totals — they are never counted as downtime.
            </p>
          </HintCollapsibleContent>
        </HintCollapsible>
        {!isLimited ? (
          <NoteDismissible cookieKey="note_status_page_history_missing_months">
            <Info />
            If there are any missing months, please contact us.
            <FormDialogSupportContact>
              <NoteButton variant="default">Request Backfill</NoteButton>
            </FormDialogSupportContact>
          </NoteDismissible>
        ) : null}
      </Section>
    </SectionGroup>
  );
}
