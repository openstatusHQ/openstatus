"use client";

import { Calendar, Info, Lock } from "@openstatus/icons";
import { Tabs, TabsList, TabsTrigger } from "@openstatus/ui/components/ui/tabs";
import { cn } from "@openstatus/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { useParams } from "next/navigation";
import { useQueryStates } from "nuqs";
import { useMemo, useState } from "react";

import { Link } from "@/components/common/link";
import { NoteButton } from "@/components/common/note";
import { NoteDismissible } from "@/components/common/note-dismissible";
import {
  BillingOverlay,
  BillingOverlayButton,
  BillingOverlayContainer,
  BillingOverlayDescription,
} from "@/components/content/billing-overlay";
import {
  EmptyStateDescription,
  EmptyStateMedia,
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
import { configurationLabels } from "@/components/forms/status-page/form-configuration";
import { FormDialogSupportContact } from "@/components/forms/support-contact/dialog";
import {
  MetricCard,
  MetricCardGroup,
  MetricCardHeader,
  MetricCardTitle,
  MetricCardValue,
} from "@/components/metric/metric-card";
import { DataTable } from "@/components/ui/data-table/data-table";
import { DataTableEmpty } from "@/components/ui/data-table/data-table-empty";
import { DataTablePaginationSimple } from "@/components/ui/data-table/data-table-pagination";
import {
  HISTORY_WINDOWS,
  getColumnVisibility,
  parseWindow,
  windowKey,
} from "@/data/status-page-history";
import { useTRPC } from "@/lib/trpc/client";

import { buildExampleHistory } from "./examples";
import { searchParamsParsers } from "./search-params";

const UPTIME_DOCS_URL =
  "https://www.openstatus.dev/docs/concept/uptime-calculation-and-values";

const MODE_LABELS = {
  requests: configurationLabels.value.requests,
  duration: configurationLabels.value.duration,
  manual: configurationLabels.type.manual,
} as const;

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
                {isLimited
                  ? "Example data. Upgrade to see your page's long-term uptime."
                  : "Long-term uptime, built from your page's components."}
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
        <MetricCardGroup
          aria-hidden={isLimited}
          className={cn(
            "md:grid-cols-4 lg:grid-cols-4",
            isLimited && "pointer-events-none blur-sm select-none",
          )}
        >
          <MetricCard variant="success">
            <MetricCardHeader>
              <MetricCardTitle className="uppercase">
                Page Uptime
              </MetricCardTitle>
            </MetricCardHeader>
            <MetricCardValue>
              {summary.uptime === null ? "—" : `${summary.uptime.toFixed(3)}%`}
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
                paginationComponent={DataTablePaginationSimple}
                columns={columns}
                data={history.rows}
                columnVisibility={columnVisibility}
              />
            </div>
            <BillingOverlay>
              <BillingOverlayButton
                data-track="paywall_viewed"
                data-limit="uptime-history"
                onClick={() => setOpenDialog(true)}
              >
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
        ) : (
          <div className="overflow-x-auto">
            <DataTable
              paginationComponent={DataTablePaginationSimple}
              columns={columns}
              // rows without a single value are not history yet
              data={hasAnyData ? history.rows : []}
              columnVisibility={columnVisibility}
              emptyState={
                <DataTableEmpty>
                  <EmptyStateMedia>
                    <Calendar />
                  </EmptyStateMedia>
                  <EmptyStateTitle>No history yet</EmptyStateTitle>
                  <EmptyStateDescription>
                    Each month is frozen early in the following month. Until
                    then, it is served live.
                  </EmptyStateDescription>
                </DataTableEmpty>
              }
            />
          </div>
        )}
        <HintCollapsible>
          <HintCollapsibleTrigger>
            <HintCollapsibleTitle>
              How uptime is calculated
            </HintCollapsibleTitle>
            <HintCollapsibleDescription>
              {isLimited
                ? "Each percentage depends on the page's calculation mode and the component type."
                : `This page uses ${MODE_LABELS[history.mode]}. Each percentage also depends on the component type.`}
            </HintCollapsibleDescription>
          </HintCollapsibleTrigger>
          <HintCollapsibleContent>
            <p className="text-muted-foreground">
              The calculation mode is set page-wide in the status page settings
              and applies to every month shown here. What is frozen monthly are
              the raw daily check counts — changing the mode re-renders all
              months from those immutable counts. See{" "}
              <Link href={UPTIME_DOCS_URL}>uptime calculation</Link> for the
              details.
            </p>
            <ul className="space-y-2.5">
              <li>
                <span className="text-foreground font-medium">
                  {MODE_LABELS.requests}
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
                <span className="text-foreground font-medium">
                  {MODE_LABELS.duration}
                </span>{" "}
                <span className="text-muted-foreground">
                  — Monitor components. Downtime is measured from incident and
                  status-report intervals, weighted by impact (major outage
                  counts fully, partial outage at half) and merged so
                  overlapping events are never double-counted.
                </span>
              </li>
              <li>
                <span className="text-foreground font-medium">
                  {MODE_LABELS.manual}
                </span>{" "}
                <span className="text-muted-foreground">
                  — No probe data is considered; uptime is derived entirely from
                  reported incidents. Static components always work this way,
                  with their full history kept — reports never expire.
                </span>
              </li>
            </ul>
            <p className="text-muted-foreground">
              Heartbeat monitors receive pings, not checks. With{" "}
              {MODE_LABELS.requests} or {MODE_LABELS.duration}, their uptime is
              the time since the first day with a ping minus incidents from
              missed or failed pings — a silent month still counts. With{" "}
              {MODE_LABELS.manual}, only status reports count.
            </p>
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
