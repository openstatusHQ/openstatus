import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@openstatus/ui";

import { CopyToClipboardButton } from "./copy-to-clipboard-button";

export function ResponseHeaderTable({
  headers,
}: {
  headers: Record<string, string>;
}) {
  return (
    <Table>
      <TableCaption className="mt-2">Response Headers</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead className="md:min-w-[200px]">Key</TableHead>
          <TableHead>Value</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {Object.entries(headers).map(([key, value]) => (
          <TableRow key={key}>
            <TableCell className="group">
              <div className="flex items-center justify-between gap-4">
                <code className="font-medium">{key}</code>
                <CopyToClipboardButton
                  copyValue={key}
                  className="invisible group-hover:visible"
                />
              </div>
            </TableCell>
            <TableCell className="group">
              <div className="flex items-center justify-between gap-4">
                <code>{value}</code>
                <CopyToClipboardButton
                  copyValue={value}
                  className="invisible group-hover:visible"
                />
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
