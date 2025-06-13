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
          <TableHead className="bg-muted/50 h-auto">Created At</TableHead>
          <TableCell>{new Date().toLocaleDateString()}</TableCell>
        </TableRow>
        <TableRow className="[&>:not(:last-child)]:border-r">
          <TableHead className="bg-muted/50 h-auto">Token</TableHead>
          <TableCell>os_3ZJh...</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}
