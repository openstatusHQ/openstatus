"use client";

import { Lock } from "@openstatus/icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Row } from "@tanstack/react-table";

import { QuickActions } from "@/components/dropdowns/quick-actions";
import { useTRPC } from "@/lib/trpc/client";

import type { ExcusedWindow } from "./columns";

const lockReason = {
  sealed: "Sealed with its month",
  closed: "Its month is closed: only the current and the previous month change",
} as const;

export function DataTableRowActions({
  row,
  readOnly,
}: {
  row: Row<ExcusedWindow>;
  readOnly: boolean;
}) {
  const excused = row.original;
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const removeMutation = useMutation(
    trpc.monitorReporting.removeExcusedWindow.mutationOptions({
      onSuccess: () =>
        queryClient.invalidateQueries({
          queryKey: trpc.monitorReporting.get.queryKey(),
        }),
    }),
  );

  if (excused.locked) {
    const title = lockReason[excused.locked];
    return (
      <span
        title={title}
        className="text-muted-foreground flex size-7 items-center justify-center"
      >
        <Lock className="size-3.5" aria-hidden="true" />
        <span className="sr-only">{title}</span>
      </span>
    );
  }
  if (readOnly) return null;
  return (
    <QuickActions
      deleteAction={{
        confirmationValue: "remove window",
        description:
          "Its checks count again for every monitor in the reporting. This cannot be undone.",
        submitAction: async () => {
          await removeMutation.mutateAsync({ id: excused.id });
        },
      }}
    />
  );
}
