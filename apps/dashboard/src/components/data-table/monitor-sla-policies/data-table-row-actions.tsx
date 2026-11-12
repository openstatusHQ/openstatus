"use client";

import type { RouterOutputs } from "@openstatus/api";
import { Hide } from "@openstatus/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Row } from "@tanstack/react-table";
import { useState } from "react";

import { QuickActions } from "@/components/dropdowns/quick-actions";
import { useTRPC } from "@/lib/trpc/client";

import { DialogArchiveMonitorSlaPolicy } from "./dialog-archive";

type MonitorSlaPolicy = RouterOutputs["monitorSlaPolicy"]["list"][number];

export function DataTableRowActions({ row }: { row: Row<MonitorSlaPolicy> }) {
  const policy = row.original;
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [archiving, setArchiving] = useState(false);
  const { data: user } = useQuery(trpc.user.get.queryOptions());
  const { data: members } = useQuery(trpc.member.list.queryOptions());
  const role = members?.find((m) => m.user.id === user?.id)?.role;
  const canEdit = role === "owner" || role === "admin";
  const invalidate = () => {
    queryClient.invalidateQueries({
      queryKey: trpc.monitorSlaPolicy.list.queryKey(),
    });
    queryClient.invalidateQueries({
      queryKey: trpc.monitorSlaPolicy.summary.queryKey(),
    });
  };
  const archiveMutation = useMutation(
    trpc.monitorSlaPolicy.archive.mutationOptions({ onSuccess: invalidate }),
  );
  const deleteMutation = useMutation(
    trpc.monitorSlaPolicy.delete.mutationOptions({ onSuccess: invalidate }),
  );

  // a sealed month is a record: such a policy can only be archived
  if (!canEdit) return <QuickActions />;
  if (policy.sealed) {
    if (policy.archivedAt) return <QuickActions />;
    return (
      <>
        <QuickActions
          actions={[
            {
              id: "archive",
              label: "Archive",
              icon: Hide,
              variant: "destructive",
              onClick: () => setArchiving(true),
            },
          ]}
        />
        <DialogArchiveMonitorSlaPolicy
          name={policy.name}
          open={archiving}
          onOpenChange={setArchiving}
          onConfirm={() => archiveMutation.mutateAsync({ id: policy.id })}
        />
      </>
    );
  }

  return (
    <QuickActions
      deleteAction={{
        confirmationValue: policy.name,
        description:
          "No month of this policy has been sealed yet, so nothing is lost. This cannot be undone.",
        submitAction: async () => {
          await deleteMutation.mutateAsync({ id: policy.id });
        },
      }}
    />
  );
}
