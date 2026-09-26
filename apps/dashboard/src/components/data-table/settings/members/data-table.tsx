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

import { QuickActions } from "@/components/dropdowns/quick-actions";
import { formatDate } from "@/lib/formatter";
import { useTRPC } from "@/lib/trpc/client";

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
          const currentUserId = user?.id;
          const isMe = Boolean(currentUserId && item.user.id === currentUserId);
          const canDelete = Boolean(
            currentUserId && item.user.id !== currentUserId,
          );

          return (
            <TableRow key={item.user.id}>
              <TableCell>
                <div className="flex items-center gap-2">
                  {item.user.name ?? (
                    <span className="text-muted-foreground">-</span>
                  )}
                  {isMe ? <Badge variant="secondary">You</Badge> : null}
                </div>
              </TableCell>
              <TableCell>{item.user.email}</TableCell>
              <TableCell>{item.role}</TableCell>
              <TableCell>
                {formatDate(item.user.createdAt ?? item.createdAt)}
              </TableCell>
              <TableCell>
                {canDelete ? (
                  <div className="flex justify-end">
                    <QuickActions
                      deleteAction={{
                        confirmationValue: item.user.email ?? "user",
                        description: workspace?.ssoEnabled
                          ? "This workspace uses SSO. They can sign in again and rejoin automatically unless you also remove them from your identity provider."
                          : undefined,
                        submitAction: async () =>
                          await deleteMemberMutation.mutateAsync({
                            id: item.user.id,
                          }),
                      }}
                    />
                  </div>
                ) : null}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
