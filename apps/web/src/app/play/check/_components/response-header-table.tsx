import { Copy } from "lucide-react";

import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@openstatus/ui";

// FIXME:
import type { Headers } from "./request-details";

export function ResponseHeaderTable({ headers }: { headers: Headers }) {
  return (
    <Table>
      <TableCaption>Response Headers</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Key</TableHead>
          <TableHead>Value</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {Object.entries(headers).map(([key, value]) => (
          <TableRow key={key}>
            <TableCell className="group">
              <div className="flex items-center justify-between gap-4">
                <code className="font-medium">{key}</code>
                <button className="text-muted-foreground hover:text-foreground invisible group-hover:visible">
                  <Copy className="h-3 w-3" />
                </button>
              </div>
            </TableCell>
            <TableCell className="group">
              <div className="flex items-center justify-between gap-4">
                <code>{value}</code>
                <button className="text-muted-foreground hover:text-foreground invisible group-hover:visible">
                  <Copy className="h-3 w-3" />
                </button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
