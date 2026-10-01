"use client";

import type { RouterOutputs } from "@openstatus/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { QuickActions } from "@/components/dropdowns/quick-actions";
import { getActions } from "@/data/status-reports.client";
import { useTRPC } from "@/lib/trpc/client";

type StatusReport = NonNullable<RouterOutputs["statusReport"]["get"]>;

export function StatusReportActions({
  report,
  publicUrl,
}: {
  report: StatusReport;
  publicUrl: string;
}) {
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();
  const remove = useMutation(
    trpc.statusReport.delete.mutationOptions({
      onSuccess: async () => {
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: trpc.statusReport.list.queryKey(),
          }),
          queryClient.invalidateQueries({
            queryKey: trpc.page.list.queryKey(),
          }),
        ]);
        router.push(`/status-pages/${report.pageId}/status-reports`);
      },
    }),
  );
  const actions = getActions({
    "view-report": () => {
      window.open(publicUrl, "_blank");
    },
  });

  return (
    <QuickActions
      actions={actions}
      deleteAction={{
        confirmationValue: report.title,
        submitAction: async () => {
          await remove.mutateAsync({ id: report.id });
        },
      }}
    />
  );
}
