import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@openstatus/ui";

import type { RegionCheck } from "../types";
import { getTotalLatency, valueFormatter } from "../utils";

// TBD: add the popover infos about timing details

export function MultiRegionTable({ regions }: { regions: RegionCheck[] }) {
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
        {regions.map(({ name, status, ...timing }) => {
          const { dns, connection, tls, ttfb, transfer } = timing;
          const total = getTotalLatency(timing);
          return (
            <TableRow key={name}>
              <TableCell className="font-medium">{name}</TableCell>
              <TableCell>{status}</TableCell>
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
