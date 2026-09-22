"use client";

import type { RouterOutputs } from "@openstatus/api";
import { currentImpactsFromUpdates } from "@openstatus/db/src/schema/page_components/constants";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { FormSheetStatusReportUpdate } from "@/components/forms/status-report-update/sheet";
import { getNextStatus } from "@/data/status-report-updates.client";
import { useTRPC } from "@/lib/trpc/client";

type StatusReport = RouterOutputs["statusReport"]["list"][number];

/** Create-update sheet prefilled with the report's next status — `children` is the trigger. */
export function FormSheetStatusReportUpdateCreate({
  report,
  children,
  open,
  onOpenChange,
}: {
  report: StatusReport;
  children?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const reportComponents =
    report.pageComponents?.map((c) => ({ id: c.id, name: c.name })) ?? [];
  const reportHasImpacts = report.updates.some(
    (u) => u.componentImpacts.length > 0,
  );
  const currentImpacts = currentImpactsFromUpdates(report.updates);
  const nextStatus = getNextStatus(report.status);
  const sendStatusReportUpdateMutation = useMutation(
    trpc.subscriberNotification.statusReport.mutationOptions(),
  );
  const createStatusReportUpdateMutation = useMutation(
    trpc.statusReport.createStatusReportUpdate.mutationOptions({
      onSuccess: (update) => {
        if (update?.notifySubscribers) {
          sendStatusReportUpdateMutation.mutate({ id: update.id });
        }
        // no-input prefix key — matches every statusReport.list query
        queryClient.invalidateQueries({
          queryKey: trpc.statusReport.list.queryKey(),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.page.list.queryKey(),
        });
      },
    }),
  );

  return (
    <FormSheetStatusReportUpdate
      open={open}
      onOpenChange={onOpenChange}
      defaultValues={{
        status: nextStatus,
        componentImpacts: reportComponents.map((c) => ({
          pageComponentId: c.id,
          impact:
            nextStatus === "resolved"
              ? "operational"
              : (currentImpacts.get(c.id) ?? "operational"),
        })),
      }}
      components={reportComponents}
      onSubmit={async (values) => {
        // a legacy report stays legacy unless the operator actively
        // sets a non-operational impact
        const sendImpacts =
          reportHasImpacts ||
          values.componentImpacts?.some((ci) => ci.impact !== "operational");
        await createStatusReportUpdateMutation.mutateAsync({
          statusReportId: report.id,
          message: values.message,
          status: values.status,
          componentImpacts: sendImpacts ? values.componentImpacts : undefined,
          date: values.date,
          notifySubscribers: values.notifySubscribers,
        });
      }}
    >
      {children}
    </FormSheetStatusReportUpdate>
  );
}
