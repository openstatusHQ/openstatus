import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from "@/components/ui/table";

export function DataTable() {
  return (
    <Table>
      <TableBody>
        <TableRow className="[&>:not(:last-child)]:border-r">
          <TableHead className="h-auto bg-muted/50">Created At</TableHead>
          <TableCell>{new Date().toLocaleDateString()}</TableCell>
        </TableRow>
        <TableRow className="[&>:not(:last-child)]:border-r">
          <TableHead className="h-auto bg-muted/50">Token</TableHead>
          <TableCell>os_3ZJh...</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}
