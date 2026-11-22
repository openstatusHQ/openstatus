"use client";

import { Calendar, Info, Lock } from "@openstatus/icons";
import { Button } from "@openstatus/ui/components/ui/button";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
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
  EmptyStateContainer,
  EmptyStateDescription,
  EmptyStateMedia,
  EmptyStateTitle,
} from "@/components/content/empty-state";
import {
  Section,
  SectionDescription,
  SectionGroup,
  SectionHeader,
  SectionTitle,
} from "@/components/content/section";
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
import { CalculationSelect } from "@/components/status-page-history/calculation-select";
import { HistoryOverview } from "@/components/status-page-history/history-overview";
import { PeriodSelect } from "@/components/status-page-history/period-select";
import {
  UptimeCalculation,
  UptimeModeTiles,
} from "@/components/status-pages/uptime-calculation";
import { historyMetric, historyRows } from "@/data/status-page-history";
import {
  UPTIME_DOCS_URL,
  UPTIME_MODES,
} from "@/data/uptime-calculation.client";
import { defaultHistoryPeriod } from "@/data/uptime-history.client";
import { useTRPC } from "@/lib/trpc/client";

import { buildExampleHistory } from "./examples";
import { searchParamsParsers } from "./search-params";

export function Client() {
  const { id } = useParams<{ id: string }>();
  const trpc = useTRPC();
  const [{ calculation, period, month }, setSearchParams] =
    useQueryStates(searchParamsParsers);
  const [openDialog, setOpenDialog] = useState(false);

  const { data: page } = useQuery(
    trpc.page.get.queryOptions({ id: Number.parseInt(id) }),
  );
  const { data: workspace } = useQuery(trpc.workspace.get.queryOptions());
  const historyLimit = workspace?.limits["uptime-history"] ?? 0;
  const isLimited = workspace?.limits["uptime-history"] === 0;

  const { data: liveHistory } = useQuery({
    ...trpc.page.getUptimeHistory.queryOptions({
      id: Number.parseInt(id),
      mode: calculation ?? undefined,
      months: period ?? undefined,
    }),
    enabled: !!workspace && !isLimited,
    // switching calculation or period keeps the last numbers until the new ones land
    placeholderData: keepPreviousData,
  });

  const exampleHistory = useMemo(
    () => (isLimited ? buildExampleHistory() : null),
    [isLimited],
  );
  const history = isLimited ? exampleHistory : liveHistory;
  const metric = historyMetric(null, history?.mode ?? "requests");
  const rows = useMemo(
    () => historyRows(history?.rows ?? [], metric),
    [history?.rows, metric],
  );

  if (!history) return null;

  const configured =
    UPTIME_MODES.find((m) => m.value === history.configuredMode) ??
    UPTIME_MODES[0];
  const current =
    UPTIME_MODES.find((m) => m.value === history.mode) ?? configured;
  const isPreview = current.value !== configured.value;
  const configurationHref = `/status-pages/${id}/components#components-configuration`;
  const countsRequests =
    current.value === "requests" || current.value === "runs";
  const showRuns = metric === "runs";
  const uptime = showRuns ? history.summary.runsUptime : history.summary.uptime;
  const partial = showRuns ? history.runsPartial : history.partial;
  const hasAnyData = rows.some((row) =>
    Object.values(row.months).some((value) => value !== null),
  );

  const overview = (
    <HistoryOverview
      rows={rows}
      months={history.months}
      month={month}
      onMonthChange={(next) => setSearchParams({ month: next })}
      timeZone={history.timeZone}
      uptime={uptime}
      mode={current.value}
      isPreview={isPreview}
    />
  );

  return (
    <SectionGroup>
      <Section id="history">
        <SectionHeader>
          <SectionTitle>{page?.title}</SectionTitle>
          <SectionDescription>
            {isLimited
              ? "Example data. Upgrade to see your page's long-term uptime."
              : `Downtime per month, built from your page's components. Months and days in ${history.timeZone}.`}
          </SectionDescription>
        </SectionHeader>
        {!isLimited ? (
          <div>
            {isPreview ? "Previewing" : "Uptime counted by"}{" "}
            <CalculationSelect
              value={current.value}
              configured={configured.value}
              onValueChange={(mode) => setSearchParams({ calculation: mode })}
            />{" "}
            over the{" "}
            <PeriodSelect
              value={Math.min(
                period ?? defaultHistoryPeriod(historyLimit),
                historyLimit,
              )}
              limit={historyLimit}
              onValueChange={(next) => setSearchParams({ period: next })}
            />{" "}
            {isPreview ? (
              <>
                <span className="text-muted-foreground">
                  Visitors see {configured.label}.
                </span>{" "}
                <Button
                  variant="link"
                  className="h-auto p-0 text-[length:inherit]"
                  onClick={() => setSearchParams({ calculation: null })}
                >
                  Back to public
                </Button>
              </>
            ) : (
              "like your public page."
            )}
          </div>
        ) : null}
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
      </Section>
      <Section id="history-overview">
        {isLimited ? (
          <BillingOverlayContainer>
            <div aria-hidden className="pointer-events-none select-none">
              {overview}
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
        ) : hasAnyData ? (
          overview
        ) : (
          <EmptyStateContainer>
            <EmptyStateMedia>
              <Calendar />
            </EmptyStateMedia>
            <EmptyStateTitle>No history yet</EmptyStateTitle>
            <EmptyStateDescription>
              Each month is frozen early in the following month. Until then, it
              is served live.
            </EmptyStateDescription>
          </EmptyStateContainer>
        )}
      </Section>
      <Section id="uptime-calculation">
        <FormCard id="how-uptime-is-calculated">
          <FormCardHeader>
            <FormCardTitle>How uptime is calculated</FormCardTitle>
            <FormCardDescription>
              This page counts{" "}
              <span className="text-foreground font-medium">
                {configured.label}
              </span>
              . It applies to your public status page; the calculation above
              only changes what you see here.{" "}
              <Link href={UPTIME_DOCS_URL}>Learn more</Link>
            </FormCardDescription>
          </FormCardHeader>
          <FormCardSeparator />
          <FormCardContent>
            <UptimeModeTiles mode={configured.value} />
          </FormCardContent>
          <FormCardSeparator />
          <FormCardContent>
            <UptimeCalculation mode={configured.value} />
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
