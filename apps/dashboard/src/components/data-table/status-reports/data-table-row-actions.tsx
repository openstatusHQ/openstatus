"use client";

import type { RouterOutputs } from "@openstatus/api";
import { currentImpactsFromUpdates } from "@openstatus/db/src/schema/page_components/constants";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Row } from "@tanstack/react-table";
import { useRef } from "react";

import { QuickActions } from "@/components/dropdowns/quick-actions";
import { FormSheetStatusReportUpdate } from "@/components/forms/status-report-update/sheet";
import { FormSheetStatusReport } from "@/components/forms/status-report/sheet";
import { toCheckboxTreeItems } from "@/components/ui/checkbox-tree";
import { getNextStatus } from "@/data/status-report-updates.client";
import { getActions } from "@/data/status-reports.client";
import { useTRPC } from "@/lib/trpc/client";

type StatusReport = RouterOutputs["statusReport"]["list"][number];

interface DataTableRowActionsProps {
  row: Row<StatusReport>;
}

// NOTE: avoid using useParams to get status page :id
// because we are using the table in the /overview page

export function DataTableRowActions({ row }: DataTableRowActionsProps) {
  if (!row.original.pageId) return null;
  const buttonCreateRef = useRef<HTMLButtonElement>(null);
  const buttonUpdateRef = useRef<HTMLButtonElement>(null);
  const actions = getActions({
    "create-update": () => buttonCreateRef.current?.click(),
    edit: () => buttonUpdateRef.current?.click(),
    "view-report": () => {
      if (typeof window !== "undefined") {
        window.open(
          `https://${
            row.original.page.customDomain ||
            `${row.original.page.slug}.openstatus.dev`
          }/events/report/${row.original.id}`,
          "_blank",
        );
      }
    },
  });
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: page } = useQuery(
    trpc.page.get.queryOptions({ id: row.original.pageId }),
  );
  const reportComponents =
    row.original.pageComponents?.map((c) => ({ id: c.id, name: c.name })) ?? [];
  const reportHasImpacts = row.original.updates.some(
    (u) => u.componentImpacts.length > 0,
  );
  const currentImpacts = currentImpactsFromUpdates(row.original.updates);
  const nextStatus = getNextStatus(row.original.status);
  const sendStatusReportUpdateMutation = useMutation(
    trpc.statusReport.notify.mutationOptions(),
  );
  const updateStatusReportMutation = useMutation(
    trpc.statusReport.updateStatus.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.statusReport.list.queryKey({
            pageId: row.original.pageId ?? undefined,
          }),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.page.list.queryKey(),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.statusReport.list.queryKey({
            period: "7d",
          }),
        });
      },
    }),
  );
  const createStatusReportUpdateMutation = useMutation(
    trpc.statusReport.createStatusReportUpdate.mutationOptions({
      onSuccess: (update) => {
        if (update?.notifySubscribers) {
          sendStatusReportUpdateMutation.mutate({ id: update.id });
        }
        queryClient.invalidateQueries({
          queryKey: trpc.statusReport.list.queryKey({
            pageId: row.original.pageId ?? undefined,
          }),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.page.list.queryKey(),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.statusReport.list.queryKey({
            period: "7d",
          }),
        });
      },
    }),
  );
  const deleteStatusReportMutation = useMutation(
    trpc.statusReport.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.statusReport.list.queryKey({
            pageId: row.original.pageId ?? undefined,
          }),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.page.list.queryKey(),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.statusReport.list.queryKey({
            period: "7d",
          }),
        });
      },
    }),
  );

  return (
    <>
      <QuickActions
        actions={actions}
        deleteAction={{
          confirmationValue: row.original.title ?? "status report",
          submitAction: async () => {
            await deleteStatusReportMutation.mutateAsync({
              id: row.original.id,
            });
          },
        }}
      />
      <FormSheetStatusReport
        items={toCheckboxTreeItems(
          page?.pageComponents ?? [],
          page?.pageComponentGroups ?? [],
        )}
        defaultValues={{
          title: row.original.title,
          status: row.original.status,
          pageComponents: row.original.pageComponents?.map((c) => c.id) ?? [],
        }}
        onSubmit={async (values) => {
          const hasComponents =
            (page?.pageComponents?.length ?? 0) > 0 ||
            (page?.pageComponentGroups?.length ?? 0) > 0;
          await updateStatusReportMutation.mutateAsync({
            id: row.original.id,
            pageComponents: hasComponents ? values.pageComponents : undefined,
            title: values.title,
            status: values.status,
          });
        }}
      >
        <button ref={buttonUpdateRef} type="button" className="sr-only">
          Open sheet
        </button>
      </FormSheetStatusReport>
      <FormSheetStatusReportUpdate
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
            statusReportId: row.original.id,
            message: values.message,
            status: values.status,
            componentImpacts: sendImpacts ? values.componentImpacts : undefined,
            date: values.date,
            notifySubscribers: values.notifySubscribers,
          });
        }}
      >
        <button ref={buttonCreateRef} type="button" className="sr-only">
          Open sheet
        </button>
      </FormSheetStatusReportUpdate>
    </>
  );
}
