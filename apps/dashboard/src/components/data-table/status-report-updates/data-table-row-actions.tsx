"use client";

import { QuickActions } from "@/components/dropdowns/quick-actions";
import { FormSheetStatusReportUpdate } from "@/components/forms/status-report-update/sheet";
import { getActions } from "@/data/status-report-updates.client";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@openstatus/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useRef } from "react";

type StatusReportUpdate =
  RouterOutputs["statusReport"]["list"][number]["updates"][number];

interface DataTableRowActionsProps {
  row: StatusReportUpdate;
}

export function DataTableRowActions({ row }: DataTableRowActionsProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const { id } = useParams<{ id: string }>();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const updateStatusReportUpdateMutation = useMutation(
    trpc.statusReport.updateStatusReportUpdate.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.statusReport.list.queryKey({ pageId: parseInt(id) }),
        });
      },
    })
  );
  const deleteStatusReportUpdateMutation = useMutation(
    trpc.statusReport.deleteUpdate.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.statusReport.list.queryKey({ pageId: parseInt(id) }),
        });
      },
    })
  );
  const actions = getActions({
    edit: () => buttonRef.current?.click(),
  });

  return (
    <>
      <QuickActions
        actions={actions}
        deleteAction={{
          title: "Delete",
          submitAction: async () => {
            await deleteStatusReportUpdateMutation.mutateAsync({
              id: row.id,
            });
          },
        }}
      />
      <FormSheetStatusReportUpdate
        defaultValues={{
          message: row.message,
          date: row.date,
          status: row.status,
        }}
        onSubmit={async (values) => {
          await updateStatusReportUpdateMutation.mutateAsync({
            id: row.id,
            statusReportId: row.statusReportId,
            message: values.message,
            status: values.status,
            date: values.date,
          });
        }}
      >
        <button ref={buttonRef} type="button" className="sr-only">
          Open sheet
        </button>
      </FormSheetStatusReportUpdate>
    </>
  );
}
