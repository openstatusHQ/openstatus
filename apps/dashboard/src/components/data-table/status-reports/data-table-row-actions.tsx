"use client";

import type { RouterOutputs } from "@openstatus/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Row } from "@tanstack/react-table";
import { useRef } from "react";

import { QuickActions } from "@/components/dropdowns/quick-actions";
import { FormSheetStatusReportUpdateCreate } from "@/components/forms/status-report-update/sheet-create";
import { FormSheetStatusReport } from "@/components/forms/status-report/sheet";
import { toCheckboxTreeItems } from "@/components/ui/checkbox-tree";
import { getActions } from "@/data/status-reports.client";
import { useTRPC } from "@/lib/trpc/client";

type StatusReport = RouterOutputs["statusReport"]["list"][number];

// NOTE: avoid using useParams to get status page :id
// because we are using the table in the /overview page

export function DataTableRowActions({ row }: { row: Row<StatusReport> }) {
  return <StatusReportRowActions report={row.original} />;
}

export function StatusReportRowActions({ report }: { report: StatusReport }) {
  const buttonCreateRef = useRef<HTMLButtonElement>(null);
  const buttonUpdateRef = useRef<HTMLButtonElement>(null);
  const actions = getActions({
    "create-update": () => buttonCreateRef.current?.click(),
    edit: () => buttonUpdateRef.current?.click(),
    "view-report": () => {
      if (typeof window !== "undefined") {
        window.open(
          `https://${
            report.page.customDomain || `${report.page.slug}.openstatus.dev`
          }/events/report/${report.id}`,
          "_blank",
        );
      }
    },
  });
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: page } = useQuery(
    trpc.page.get.queryOptions(
      { id: report.pageId ?? 0 },
      { enabled: report.pageId !== null },
    ),
  );
  // no-input prefix key — matches every statusReport.list query (overview, page detail)
  const invalidateLists = () => {
    queryClient.invalidateQueries({
      queryKey: trpc.statusReport.list.queryKey(),
    });
    queryClient.invalidateQueries({
      queryKey: trpc.page.list.queryKey(),
    });
  };
  const updateStatusReportMutation = useMutation(
    trpc.statusReport.updateStatus.mutationOptions({
      onSuccess: invalidateLists,
    }),
  );
  const deleteStatusReportMutation = useMutation(
    trpc.statusReport.delete.mutationOptions({
      onSuccess: invalidateLists,
    }),
  );

  if (!report.pageId) return null;

  return (
    <>
      <QuickActions
        actions={actions}
        deleteAction={{
          confirmationValue: report.title ?? "status report",
          submitAction: async () => {
            await deleteStatusReportMutation.mutateAsync({
              id: report.id,
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
          title: report.title,
          status: report.status,
          pageComponents: report.pageComponents?.map((c) => c.id) ?? [],
        }}
        onSubmit={async (values) => {
          const hasComponents =
            (page?.pageComponents?.length ?? 0) > 0 ||
            (page?.pageComponentGroups?.length ?? 0) > 0;
          await updateStatusReportMutation.mutateAsync({
            id: report.id,
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
      <FormSheetStatusReportUpdateCreate report={report}>
        <button ref={buttonCreateRef} type="button" className="sr-only">
          Open sheet
        </button>
      </FormSheetStatusReportUpdateCreate>
    </>
  );
}
