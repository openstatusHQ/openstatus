import { ShieldUser } from "@openstatus/icons";
import { Badge } from "@openstatus/ui/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@openstatus/ui/components/ui/table";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { QuickActions } from "@/components/dropdowns/quick-actions";
import { formatDate } from "@/lib/formatter";
import { useTRPC } from "@/lib/trpc/client";

import { TableCellEmpty } from "../../table-cell-empty";
import { TransferOwnershipDialog } from "./transfer-ownership-dialog";

export function DataTable() {
  const trpc = useTRPC();
  const { data: members, refetch } = useQuery(trpc.member.list.queryOptions());
  const { data: user } = useQuery(trpc.user.get.queryOptions());
  const { data: workspace } = useQuery(trpc.workspace.get.queryOptions());
  const deleteMemberMutation = useMutation(
    trpc.member.delete.mutationOptions({
      onSuccess: () => refetch(),
    }),
  );

  if (!members) return null;

  const currentUserId = user?.id;
  const isOwner =
    members.find((m) => m.user.id === currentUserId)?.role === "owner";

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Created</TableHead>
          <TableHead>
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {members.map((item) => {
          const isMe = Boolean(currentUserId && item.user.id === currentUserId);
          // The server rejects non-owners; don't offer what will fail.
          const canDelete = isOwner && !isMe;

          return (
            <TableRow key={item.user.id}>
              <TableCell>
                <div className="flex items-center gap-2">
                  {item.user.name ?? <TableCellEmpty>No name</TableCellEmpty>}
                  {isMe ? <Badge variant="secondary">You</Badge> : null}
                </div>
              </TableCell>
              <TableCell>{item.user.email}</TableCell>
              <TableCell>
                <Badge
                  variant={item.role === "owner" ? "default" : "outline"}
                  className="capitalize"
                >
                  {item.role}
                </Badge>
              </TableCell>
              <TableCell>
                {formatDate(item.user.createdAt ?? item.createdAt)}
              </TableCell>
              <TableCell>
                {canDelete ? (
                  <MemberRowActions
                    member={item}
                    ssoEnabled={!!workspace?.ssoEnabled}
                    onDelete={async () =>
                      await deleteMemberMutation.mutateAsync({
                        id: item.user.id,
                      })
                    }
                  />
                ) : null}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function MemberRowActions({
  member,
  ssoEnabled,
  onDelete,
}: {
  member: {
    role: string;
    user: {
      id: number;
      name: string | null;
      email: string | null;
      deletedAt: Date | null;
    };
  };
  ssoEnabled: boolean;
  onDelete: () => Promise<void>;
}) {
  const [transferOpen, setTransferOpen] = useState(false);
  const { user } = member;
  const canTransfer =
    member.role !== "owner" && !user.deletedAt && !!user.email;

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
          description: ssoEnabled
            ? "This workspace uses SSO. They can sign in again and rejoin automatically unless you also remove them from your identity provider."
            : undefined,
          submitAction: onDelete,
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
