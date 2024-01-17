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
  regionFormatter,
  valueFormatter,
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
                <code>{valueFormatter(dns)}</code>
              </TableCell>
              <TableCell className="text-muted-foreground">
                <code>{valueFormatter(connection)}</code>
              </TableCell>
              <TableCell className="text-muted-foreground">
                <code>{valueFormatter(tls)}</code>
              </TableCell>
              <TableCell className="text-muted-foreground">
                <code>{valueFormatter(ttfb)}</code>
              </TableCell>
              <TableCell>
                <code>{valueFormatter(total)}</code>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
