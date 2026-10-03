"use client";

import type { RouterOutputs } from "@openstatus/api";
import { useCopyToClipboard } from "@openstatus/ui/hooks/use-copy-to-clipboard";
import { buildCurlCommand } from "@openstatus/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Row } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { ExportCodeDialog } from "@/components/dialogs/export-code";
import { QuickActions } from "@/components/dropdowns/quick-actions";
import { getActions } from "@/data/monitors.client";
import { buildMonitorBadgeUrl } from "@/lib/monitor-badge";
import { useTRPC } from "@/lib/trpc/client";

type Monitor = RouterOutputs["monitor"]["list"][number];
interface DataTableRowActionsProps {
  row: Row<Monitor>;
}

export function DataTableRowActions({ row }: DataTableRowActionsProps) {
  const [openDialog, setOpenDialog] = useState(false);
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { copy } = useCopyToClipboard();
  const { data: pageComponents } = useQuery(
    trpc.pageComponent.list.queryOptions(),
  );
  const { data: statusPages } = useQuery(trpc.page.list.queryOptions());
  const deleteMonitorMutation = useMutation(
    trpc.monitor.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.monitor.list.queryOptions());
      },
    }),
  );
  const router = useRouter();
  // curl only speaks HTTP — the action is hidden for tcp/dns monitors
  const isHttp = row.original.jobType === "http";

  const statusPage = row.original.public
    ? statusPages?.find(
        (p) =>
          p.accessType === "public" &&
          pageComponents?.some(
            (c) => c.monitorId === row.original.id && c.pageId === p.id,
          ),
      )
    : undefined;

  const actions = getActions({
    edit: () => router.push(`/monitors/${row.original.id}/edit`),
    "copy-id": () => {
      navigator.clipboard.writeText(row.original.id.toString());
      toast.success("Monitor ID copied to clipboard");
    },
    "copy-curl": isHttp
      ? async () => {
          await navigator.clipboard.writeText(buildCurlCommand(row.original));
          toast.success("cURL command copied to clipboard");
        }
      : undefined,
    "copy-badge": () => {
      if (!statusPage) {
        toast.error("Monitor is not attached to a public status page");
        return;
      }
      const badgeUrl = buildMonitorBadgeUrl(statusPage, row.original.id);
      void copy(badgeUrl, {
        withToast: true,
        successMessage: "Badge URL copied to clipboard",
      });
    },
    // export: () => setOpenDialog(true),
  }).filter((action) => action.id !== "copy-curl" || isHttp);

  return (
    <>
      <QuickActions
        actions={actions}
        deleteAction={{
          confirmationValue: row.original.name ?? "monitor",
          submitAction: async () => {
            await deleteMonitorMutation.mutateAsync({
              id: row.original.id,
            });
          },
        }}
      />
      <ExportCodeDialog open={openDialog} onOpenChange={setOpenDialog} />
    </>
  );
}
