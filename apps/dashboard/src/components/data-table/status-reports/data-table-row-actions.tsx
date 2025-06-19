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
    edit: () => buttonCreateRef.current?.click(),
    "create-update": () => buttonUpdateRef.current?.click(),
  });
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { id } = useParams<{ id: string }>();
  const { data: monitors } = useQuery(trpc.monitor.list.queryOptions());
  const updateStatusReportMutation = useMutation(
    trpc.statusReport.updateStatus.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.statusReport.list.queryKey({ pageId: parseInt(id) }),
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
          confirmationValue: "delete",
        }}
      />
      <FormSheetStatusReport
        monitors={monitors}
        defaultValues={{
          title: row.original.title,
          status: row.original.status,
          monitors: row.original.monitors,
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
        <button ref={buttonCreateRef} type="button" className="sr-only">
          Open sheet
        </button>
      </FormSheetStatusReport>
      <FormSheetStatusReportUpdate>
        <button ref={buttonUpdateRef} type="button" className="sr-only">
          Open sheet
        </button>
      </FormSheetStatusReportUpdate>
    </>
  );
}
