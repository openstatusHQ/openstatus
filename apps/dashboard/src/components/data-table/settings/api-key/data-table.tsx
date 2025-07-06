import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from "@/components/ui/table";
import { RouterOutputs } from "@openstatus/api";

type ApiKey = RouterOutputs["apiKey"]["get"];

export function DataTable({ apiKey }: { apiKey: ApiKey }) {
  return (
    <Table>
      <TableBody>
        <TableRow className="[&>:not(:last-child)]:border-r">
          <TableHead className="h-auto bg-muted/50">Created At</TableHead>
          <TableCell>
            {new Date(apiKey.createdAt).toLocaleDateString()}
          </TableCell>
        </TableRow>
        <TableRow className="[&>:not(:last-child)]:border-r">
          <TableHead className="h-auto bg-muted/50">Token</TableHead>
          <TableCell>{apiKey.start}...</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}
