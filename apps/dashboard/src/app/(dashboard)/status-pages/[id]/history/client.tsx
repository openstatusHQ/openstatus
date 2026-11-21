"use client";

import { Calendar, Info, Lock } from "@openstatus/icons";
import { Button } from "@openstatus/ui/components/ui/button";
import { cn } from "@openstatus/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import NextLink from "next/link";
import { useParams } from "next/navigation";
import { useQueryStates } from "nuqs";
import { useMemo, useState } from "react";

import { Link } from "@/components/common/link";
import { Note, NoteButton } from "@/components/common/note";
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
  Section,
  SectionDescription,
  SectionGroup,
  SectionHeader,
  SectionHeaderRow,
  SectionTitle,
} from "@/components/content/section";
import { getColumns } from "@/components/data-table/status-page-history/columns";
import { UpgradeDialog } from "@/components/dialogs/upgrade";
import {
  FormCard,
  FormCardContent,
  FormCardDescription,
  FormCardFooter,
  FormCardFooterInfo,
  FormCardHeader,
  FormCardSeparator,
  FormCardTitle,
} from "@/components/forms/form-card";
import { FormDialogSupportContact } from "@/components/forms/support-contact/dialog";
import {
  MetricStrip,
  MetricStripAside,
  MetricStripItem,
  MetricStripLabel,
  MetricStripRow,
  MetricStripValue,
} from "@/components/metric/metric-strip";
import { UptimeMetricTabs } from "@/components/metric/uptime-metric-tabs";
import {
  UptimeCalculation,
  UptimeModeTiles,
} from "@/components/status-pages/uptime-calculation";
import { DataTable } from "@/components/ui/data-table/data-table";
import { DataTableEmpty } from "@/components/ui/data-table/data-table-empty";
import { DataTablePaginationSimple } from "@/components/ui/data-table/data-table-pagination";
import { historyMetric, historyRows } from "@/data/status-page-history";
import {
  UPTIME_DOCS_URL,
  UPTIME_MODES,
} from "@/data/uptime-calculation.client";
import { truncatePercentage } from "@/lib/formatter";
import { useTRPC } from "@/lib/trpc/client";

import { buildExampleHistory } from "./examples";
import { searchParamsParsers } from "./search-params";

export function Client() {
  const { id } = useParams<{ id: string }>();
  const trpc = useTRPC();
  const [{ metric: metricParam }, setSearchParams] =
    useQueryStates(searchParamsParsers);
  const [openDialog, setOpenDialog] = useState(false);

  const { data: page } = useQuery(
    trpc.page.get.queryOptions({ id: Number.parseInt(id) }),
  );
  const { data: workspace } = useQuery(trpc.workspace.get.queryOptions());
  const isLimited = workspace?.limits["uptime-history"] === false;

  const { data: liveHistory } = useQuery({
    ...trpc.page.getUptimeHistory.queryOptions({ id: Number.parseInt(id) }),
    enabled: !!workspace && !isLimited,
  });

  const exampleHistory = useMemo(
    () => (isLimited ? buildExampleHistory() : null),
    [isLimited],
  );
  const history = isLimited ? exampleHistory : liveHistory;
  const metric = historyMetric(metricParam, history?.mode ?? "requests");
  const rows = useMemo(
    () => historyRows(history?.rows ?? [], metric),
    [history?.rows, metric],
  );

  const columns = useMemo(
    () =>
      getColumns(
        history?.months ?? [],
        history?.timeZone,
        history?.utcOnlyMonths,
      ),
    [history?.months, history?.timeZone, history?.utcOnlyMonths],
  );

  if (!history) return null;

  const uptimeMode =
    UPTIME_MODES.find((m) => m.value === history.mode) ?? UPTIME_MODES[0];
  const configurationHref = `/status-pages/${id}/components#components-configuration`;
  const { summary } = history;
  const countsRequests = history.mode === "requests" || history.mode === "runs";
  const showMetric = !isLimited && countsRequests;
  const showRuns = showMetric && metric === "runs";
  const uptime = showRuns ? summary.runsUptime : summary.uptime;
  const partial = showRuns ? history.runsPartial : history.partial;
  // rows without a value are left out of the page average
  const averaged = rows.filter((row) => row.total !== null).length;
  const hasAnyData = rows.some((row) =>
    Object.values(row.months).some((value) => value !== null),
  );

  return (
    <SectionGroup>
      <Section id="history">
        <SectionHeaderRow>
          <SectionHeader>
            <SectionTitle>{page?.title}</SectionTitle>
            <SectionDescription>
              {isLimited
                ? "Example data. Upgrade to see your page's long-term uptime."
                : `Long-term uptime, built from your page's components. Months and days in ${history.timeZone}.`}
            </SectionDescription>
          </SectionHeader>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {showMetric ? (
              <UptimeMetricTabs
                value={metric}
                onValueChange={(m) => setSearchParams({ metric: m })}
              />
            ) : null}
          </div>
        </SectionHeaderRow>
        {!isLimited ? (
          <NoteDismissible cookieKey="note_reports_global_status_pages">
            <Info />
            Need one report across all your status pages? Let us know.
            <FormDialogSupportContact
              defaultValues={{
                type: "feature",
                message:
                  "I'm interested in a report across all my status pages. What I need: ",
              }}
            >
              <NoteButton variant="default">Tell us what you need</NoteButton>
            </FormDialogSupportContact>
          </NoteDismissible>
        ) : null}
        {!isLimited && partial ? (
          <Note color="warning" size="sm">
            <Info />
            Recent{" "}
            {showRuns
              ? "runs"
              : countsRequests
                ? "requests"
                : "uptime data"}{" "}
            couldn&apos;t be loaded, so the latest months may be incomplete.
          </Note>
        ) : null}
        {!isLimited &&
        history.timeZone !== "UTC" &&
        history.utcOnlyMonths.length > 0 ? (
          <Note size="sm">
            <Info />
            Months marked UTC were frozen before days could be regrouped, so
            their days follow UTC rather than {history.timeZone}.
          </Note>
        ) : null}
      </Section>
      <Section id="history-metrics">
        <MetricStrip
          aria-hidden={isLimited}
          className={cn(isLimited && "pointer-events-none select-none")}
        >
          <MetricStripRow>
            <MetricStripItem status="success">
              <MetricStripLabel>Page uptime</MetricStripLabel>
              <MetricStripValue>
                {uptime === null ? "—" : `${truncatePercentage(uptime)}%`}
                {averaged > 0 && averaged < rows.length ? (
                  <MetricStripAside>
                    {averaged} of {rows.length} components
                  </MetricStripAside>
                ) : null}
              </MetricStripValue>
            </MetricStripItem>
            <MetricStripItem>
              <MetricStripLabel>Reports</MetricStripLabel>
              <MetricStripValue>{summary.reports}</MetricStripValue>
            </MetricStripItem>
            <MetricStripItem>
              <MetricStripLabel>Components</MetricStripLabel>
              <MetricStripValue>{rows.length}</MetricStripValue>
            </MetricStripItem>
            <MetricStripItem>
              <MetricStripLabel>Created at</MetricStripLabel>
              <MetricStripValue>
                {history.createdAt ? format(history.createdAt, "MMM yy") : "—"}
              </MetricStripValue>
            </MetricStripItem>
          </MetricStripRow>
        </MetricStrip>
        {isLimited ? (
          <BillingOverlayContainer>
            <div className="overflow-x-auto">
              <DataTable
                paginationComponent={DataTablePaginationSimple}
                columns={columns}
                data={rows}
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
                Keep an overview of your uptime history for the last 12 months.
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
              data={hasAnyData ? rows : []}
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
        {!isLimited ? (
          <NoteDismissible cookieKey="note_status_page_history_missing_months">
            <Info />
            Is a month missing that your monitors were running? Let us know.
            <FormDialogSupportContact>
              <NoteButton variant="default">Contact us</NoteButton>
            </FormDialogSupportContact>
          </NoteDismissible>
        ) : null}
      </Section>
      <Section id="uptime-calculation">
        <FormCard id="how-uptime-is-calculated">
          <FormCardHeader>
            <FormCardTitle>How uptime is calculated</FormCardTitle>
            <FormCardDescription>
              This page counts{" "}
              <span className="text-foreground font-medium">
                {uptimeMode.label}
              </span>
              . It applies to every month here and to your public status page.{" "}
              <Link href={UPTIME_DOCS_URL}>Learn more</Link>
            </FormCardDescription>
          </FormCardHeader>
          <FormCardSeparator />
          <FormCardContent>
            <UptimeModeTiles mode={uptimeMode.value} />
          </FormCardContent>
          <FormCardSeparator />
          <FormCardContent>
            <UptimeCalculation mode={uptimeMode.value} />
          </FormCardContent>
          <FormCardFooter className="flex-wrap">
            <FormCardFooterInfo>
              Change it in{" "}
              <Link href={configurationHref}>
                Components &gt; Components Configuration
              </Link>
              . Months follow{" "}
              <Link href={`/status-pages/${id}/edit#timezone`}>
                Settings &gt; Timezone
              </Link>
              .
            </FormCardFooterInfo>
            <Button size="sm" asChild>
              <NextLink href={configurationHref}>Change calculation</NextLink>
            </Button>
          </FormCardFooter>
        </FormCard>
      </Section>
    </SectionGroup>
  );
}
