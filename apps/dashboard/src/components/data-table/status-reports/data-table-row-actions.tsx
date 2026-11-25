"use client";

import type { RouterOutputs } from "@openstatus/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { QuickActions } from "@/components/dropdowns/quick-actions";
import { getPageUrl } from "@/data/status-pages.client";
import { getActions } from "@/data/status-reports.client";
import { useTRPC } from "@/lib/trpc/client";

type StatusReport = RouterOutputs["statusReport"]["list"][number];

// no useParams for the page :id: these rows also render on /overview
export function StatusReportRowActions({
  report,
  onAddUpdate,
  onResolve,
}: {
  report: StatusReport;
  onAddUpdate?: () => void;
  onResolve?: () => void;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  // only wired actions: a resolved report has nothing to add or resolve
  const actions = getActions({
    "add-update": onAddUpdate,
    resolve: onResolve,
    "view-report": () => {
      window.open(
        `${getPageUrl(report.page)}/events/report/${report.id}`,
        "_blank",
      );
    },
  }).filter((action) => action.onClick);
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
