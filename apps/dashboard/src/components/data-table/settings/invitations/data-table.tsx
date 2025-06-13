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
import type { Invitation } from "@/data/invitations";

export function DataTable({ data }: { data: Invitation[] }) {
  if (data.length === 0) {
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
        {data.map((item) => (
          <TableRow key={item.id}>
            <TableCell>{item.email}</TableCell>
            <TableCell>{item.role}</TableCell>
            <TableCell>{item.createdAt}</TableCell>
            <TableCell>{item.expiresAt}</TableCell>
            <TableCell>{item.acceptedAt}</TableCell>
            <TableCell>
              <div className="flex justify-end">
                <QuickActions deleteAction={{ title: "Invitation" }} />
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
