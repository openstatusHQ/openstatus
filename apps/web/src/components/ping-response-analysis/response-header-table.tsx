import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@openstatus/ui/src/components/table";

import { CopyToClipboardButton } from "./copy-to-clipboard-button";
import { ResponseHeaderAnalysis } from "./response-header-analysis";

export function ResponseHeaderTable({
  headers,
  status,
}: {
  headers: Record<string, string>;
  status: number;
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
              <div className="flex min-w-[130px] items-center justify-between gap-2">
                <div className="flex items-center justify-between gap-2">
                  <code className="break-all font-medium">{key}</code>
                  <ResponseHeaderAnalysis
                    headerKey={key}
                    headers={headers}
                    status={status}
                  />
                </div>
                <CopyToClipboardButton
                  copyValue={key}
                  className="invisible group-hover:visible"
                />
              </div>
            </TableCell>
            <TableCell className="group">
              <div className="flex items-center justify-between gap-1">
                <code className="break-all">{value}</code>
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
