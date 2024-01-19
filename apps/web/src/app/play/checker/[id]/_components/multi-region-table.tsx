import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@openstatus/ui";

import type { RegionChecker } from "../utils";
import {
  getTimingPhases,
  getTotalLatency,
  latencyFormatter,
  regionFormatter,
} from "../utils";
import { StatusBadge } from "./status-badge";

// TBD: add the popover infos about timing details

export function MultiRegionTable({ regions }: { regions: RegionChecker[] }) {
  return (
    <Table>
      <TableCaption>Multi Regions</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Region</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>DNS</TableHead>
          <TableHead>Connect</TableHead>
          <TableHead>TLS</TableHead>
          <TableHead>TTFB</TableHead>
          <TableHead>Total</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {regions.map(({ region, status, timing }) => {
          const { dns, connection, tls, ttfb, transfer } =
            getTimingPhases(timing);
          const total = getTotalLatency(timing);
          return (
            <TableRow key={region}>
              <TableCell className="font-medium">
                {regionFormatter(region)}
              </TableCell>
              <TableCell>
                <StatusBadge statusCode={status} />
              </TableCell>
              <TableCell className="text-muted-foreground">
                <code>{latencyFormatter(dns)}</code>
              </TableCell>
              <TableCell className="text-muted-foreground">
                <code>{latencyFormatter(connection)}</code>
              </TableCell>
              <TableCell className="text-muted-foreground">
                <code>{latencyFormatter(tls)}</code>
              </TableCell>
              <TableCell className="text-muted-foreground">
                <code>{latencyFormatter(ttfb)}</code>
              </TableCell>
              <TableCell>
                <code>{latencyFormatter(total)}</code>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
