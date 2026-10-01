"use client";

import type { RouterOutputs } from "@openstatus/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Row } from "@tanstack/react-table";

import { QuickActions } from "@/components/dropdowns/quick-actions";
import { getPageUrl } from "@/data/status-pages.client";
import { getActions } from "@/data/status-reports.client";
import { useTRPC } from "@/lib/trpc/client";

type StatusReport = RouterOutputs["statusReport"]["list"][number];

// NOTE: avoid using useParams to get status page :id
// because we are using the table in the /overview page

export function DataTableRowActions({ row }: { row: Row<StatusReport> }) {
  return <StatusReportRowActions report={row.original} />;
}

export function StatusReportRowActions({ report }: { report: StatusReport }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const actions = getActions({
    "view-report": () => {
      window.open(
        `${getPageUrl(report.page)}/events/report/${report.id}`,
        "_blank",
      );
    },
  });
  const deleteStatusReportMutation = useMutation(
    trpc.statusReport.delete.mutationOptions({
      // no-input prefix key — matches every statusReport.list query (overview, page detail)
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.statusReport.list.queryKey(),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.page.list.queryKey(),
        });
      },
    }),
  );

  if (!report.pageId) return null;

  return (
    <QuickActions
      actions={actions}
      deleteAction={{
        confirmationValue: report.title ?? "status report",
        submitAction: async () => {
          await deleteStatusReportMutation.mutateAsync({ id: report.id });
        },
      }}
    />
  );
}
