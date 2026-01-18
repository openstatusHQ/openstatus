"use client";

import { QuickActions } from "@/components/dropdowns/quick-actions";
import { FormSheetStatusReportUpdate } from "@/components/forms/status-report-update/sheet";
import { FormSheetStatusReport } from "@/components/forms/status-report/sheet";
import { getActions } from "@/data/status-reports.client";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@openstatus/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Row } from "@tanstack/react-table";
import { useRef } from "react";

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
  const sendStatusReportUpdateMutation = useMutation(
    trpc.emailRouter.sendStatusReport.mutationOptions(),
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
      },
    }),
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
          queryKey: trpc.statusReport.list.queryKey({
            pageId: row.original.pageId ?? undefined,
          }),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.page.list.queryKey(),
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
        pageComponents={page?.pageComponents ?? []}
        defaultValues={{
          title: row.original.title,
          status: row.original.status,
          pageComponents: row.original.pageComponents?.map((c) => c.id) ?? [],
        }}
        onSubmit={async (values) => {
          await updateStatusReportMutation.mutateAsync({
            id: row.original.id,
            pageComponents: values.pageComponents,
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
