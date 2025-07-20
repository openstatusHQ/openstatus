"use client";

import { QuickActions } from "@/components/dropdowns/quick-actions";
import { FormSheetStatusReportUpdate } from "@/components/forms/status-report-update/sheet";
import { FormSheetStatusReport } from "@/components/forms/status-report/sheet";
import { getActions } from "@/data/status-reports.client";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@openstatus/api";
import type { Row } from "@tanstack/react-table";
import { useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";

type StatusReport = RouterOutputs["statusReport"]["list"][number];

interface DataTableRowActionsProps {
  row: Row<StatusReport>;
}

export function DataTableRowActions({ row }: DataTableRowActionsProps) {
  const buttonCreateRef = useRef<HTMLButtonElement>(null);
  const buttonUpdateRef = useRef<HTMLButtonElement>(null);
  const actions = getActions({
    "create-update": () => buttonCreateRef.current?.click(),
    edit: () => buttonUpdateRef.current?.click(),
    "view-report": () => {
      if (typeof window !== "undefined") {
        window.open(
          `https://${row.original.page.customDomain || `${row.original.page.slug}.openstatus.dev/events/report/${row.original.id}`}`,
          "_blank"
        );
      }
    },
  });
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { id } = useParams<{ id: string }>();
  const { data: monitors } = useQuery(trpc.monitor.list.queryOptions());
  const sendStatusReportUpdateMutation = useMutation(
    trpc.emailRouter.sendStatusReport.mutationOptions()
  );
  const updateStatusReportMutation = useMutation(
    trpc.statusReport.updateStatus.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.statusReport.list.queryKey({ pageId: parseInt(id) }),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.page.list.queryKey(),
        });
      },
    })
  );
  const createStatusReportUpdateMutation = useMutation(
    trpc.statusReport.createStatusReportUpdate.mutationOptions({
      onSuccess: (update) => {
        // TODO: move to server
        if (update) {
          sendStatusReportUpdateMutation.mutateAsync({ id: update.id });
        }
        //
        queryClient.invalidateQueries({
          queryKey: trpc.statusReport.list.queryKey({ pageId: parseInt(id) }),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.page.list.queryKey(),
        });
      },
    })
  );
  const deleteStatusReportMutation = useMutation(
    trpc.statusReport.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.statusReport.list.queryKey({ pageId: parseInt(id) }),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.page.list.queryKey(),
        });
      },
    })
  );

  if (!monitors) return null;

  return (
    <>
      <QuickActions
        actions={actions}
        deleteAction={{
          title: "Delete",
          submitAction: async () => {
            await deleteStatusReportMutation.mutateAsync({
              id: row.original.id,
            });
          },
        }}
      />
      <FormSheetStatusReport
        monitors={monitors}
        defaultValues={{
          title: row.original.title,
          status: row.original.status,
          monitors: row.original.monitors.map((m) => m.id),
        }}
        onSubmit={async (values) => {
          await updateStatusReportMutation.mutateAsync({
            id: row.original.id,
            monitors: values.monitors,
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
        onSubmit={async (values) => {
          await createStatusReportUpdateMutation.mutateAsync({
            statusReportId: row.original.id,
            message: values.message,
            status: values.status,
            date: values.date,
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
