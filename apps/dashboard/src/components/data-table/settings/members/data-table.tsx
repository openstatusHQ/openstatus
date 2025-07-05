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
  const { data: members, refetch } = useQuery(trpc.member.list.queryOptions());
  const deleteMemberMutation = useMutation(
    trpc.member.delete.mutationOptions({
      onSuccess: () => refetch(),
    })
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
        {members.map((item) => (
          <TableRow key={item.user.id}>
            <TableCell>
              {item.user.name ?? (
                <span className="text-muted-foreground">-</span>
              )}
            </TableCell>
            <TableCell>{item.user.email}</TableCell>
            <TableCell>{item.role}</TableCell>
            <TableCell>{formatDate(item.createdAt)}</TableCell>
            <TableCell>
              <div className="flex justify-end">
                <QuickActions
                  deleteAction={{
                    title: "Member",
                    confirmationValue: "delete member",
                    // FIXME: when deleting myself, throws an error, should have been caught by the toast.error
                    submitAction: async () =>
                      await deleteMemberMutation.mutateAsync({
                        id: item.user.id,
                      }),
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
