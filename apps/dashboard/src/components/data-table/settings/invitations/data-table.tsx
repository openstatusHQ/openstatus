import {
  EmptyStateContainer,
  EmptyStateDescription,
  EmptyStateTitle,
} from "@/components/content/empty-state";
import { QuickActions } from "@/components/dropdowns/quick-actions";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/formatter";
import { useTRPC } from "@/lib/trpc/client";
import { useMutation, useQuery } from "@tanstack/react-query";

export function DataTable() {
  const trpc = useTRPC();
  const { data: invitations, refetch } = useQuery(
    trpc.invitation.list.queryOptions()
  );
  const deleteInvitationMutation = useMutation(
    trpc.invitation.delete.mutationOptions({
      onSuccess: () => refetch(),
    })
  );

  if (!invitations) return null;

  if (invitations.length === 0) {
    return (
      <EmptyStateContainer>
        <EmptyStateTitle>No pending invitations</EmptyStateTitle>
        <EmptyStateDescription>
          Only active invitations are shown here.
        </EmptyStateDescription>
      </EmptyStateContainer>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Email</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Created At</TableHead>
          <TableHead>Expires At</TableHead>
          <TableHead>Accepted At</TableHead>
          <TableHead>
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {invitations.map((item) => (
          <TableRow key={item.id}>
            <TableCell>{item.email}</TableCell>
            <TableCell>{item.role}</TableCell>
            <TableCell>
              {item.createdAt ? formatDate(item.createdAt) : "-"}
            </TableCell>
            <TableCell>{formatDate(item.expiresAt)}</TableCell>
            <TableCell>
              {item.acceptedAt ? formatDate(item.acceptedAt) : "-"}
            </TableCell>
            <TableCell>
              <div className="flex justify-end">
                <QuickActions
                  deleteAction={{
                    title: "Invitation",
                    submitAction: async () =>
                      deleteInvitationMutation.mutateAsync({ id: item.id }),
                  }}
                />
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
