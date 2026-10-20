"use client";

import type { RouterOutputs } from "@openstatus/api";
import { ShieldUser } from "@openstatus/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Row } from "@tanstack/react-table";
import { useState } from "react";

import { QuickActions } from "@/components/dropdowns/quick-actions";
import { useTRPC } from "@/lib/trpc/client";

import { TransferOwnershipDialog } from "./transfer-ownership-dialog";

type Member = RouterOutputs["member"]["list"][number];

interface DataTableRowActionsProps {
  row: Row<Member>;
}

export function DataTableRowActions({ row }: DataTableRowActionsProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: members } = useQuery(trpc.member.list.queryOptions());
  const { data: currentUser } = useQuery(trpc.user.get.queryOptions());
  const { data: workspace } = useQuery(trpc.workspace.get.queryOptions());
  const deleteMemberMutation = useMutation(
    trpc.member.delete.mutationOptions({
      onSuccess: () =>
        queryClient.invalidateQueries({
          queryKey: trpc.member.list.queryKey(),
        }),
    }),
  );
  const [transferOpen, setTransferOpen] = useState(false);

  const member = row.original;
  const { user } = member;
  const isOwner =
    members?.find((m) => m.user.id === currentUser?.id)?.role === "owner";
  const isMe = Boolean(currentUser?.id && user.id === currentUser.id);
  const canTransfer =
    member.role !== "owner" && !user.deletedAt && !!user.email;

  // The server rejects non-owners; don't offer what will fail.
  if (!isOwner || isMe) return null;

  return (
    <div className="flex justify-end">
      <QuickActions
        actions={
          canTransfer
            ? [
                {
                  id: "transfer",
                  label: "Make owner",
                  icon: ShieldUser,
                  variant: "default",
                  onClick: () => setTransferOpen(true),
                },
              ]
            : undefined
        }
        deleteAction={{
          confirmationValue: user.email ?? "user",
          description: workspace?.ssoEnabled
            ? "This workspace uses SSO. They can sign in again and rejoin automatically unless you also remove them from your identity provider."
            : undefined,
          submitAction: async () => {
            await deleteMemberMutation.mutateAsync({ id: user.id });
          },
        }}
      />
      {/* Outside `QuickActions`: its dropdown item unmounts with the menu. */}
      {canTransfer && user.email ? (
        <TransferOwnershipDialog
          member={{ id: user.id, name: user.name, email: user.email }}
          open={transferOpen}
          onOpenChange={setTransferOpen}
        />
      ) : null}
    </div>
  );
}
