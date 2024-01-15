import { Info } from "lucide-react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@openstatus/ui";

import { timingDict } from "./request-details";
import type { Timing } from "./request-details";

function getTotalLatency(timing: Timing) {
  const { dns, connection, tls, ttfb, transfer } = timing;
  return dns + connection + tls + ttfb + transfer;
}

export function ResponseTimingTable({ timing }: { timing: Timing }) {
  const total = getTotalLatency(timing);
  return (
    <Table>
      <TableCaption>Response Timing</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[120px] md:w-[150px]">Timing</TableHead>
          <TableHead className="w-[120px] md:w-[150px]">Duration</TableHead>
          <TableHead></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {Object.entries(timing).map(([key, value]) => {
          const { short, long, description } =
            timingDict[key as keyof typeof timing];
          return (
            <TableRow key={key}>
              <TableCell>
                <div className="flex w-[80px] items-center justify-between gap-2">
                  <p className="text-muted-foreground">{short}</p>
                  <Popover>
                    <PopoverTrigger className="text-muted-foreground hover:text-foreground data-[state=open]:text-foreground">
                      <Info className="h-4 w-4" />
                    </PopoverTrigger>
                    <PopoverContent>
                      <p className="font-medium">{long}</p>
                      <p className="text-muted-foreground text-sm">
                        {description}
                      </p>
                    </PopoverContent>
                  </Popover>
                </div>
              </TableCell>
              <TableCell>
                <code>{value}ms</code>
              </TableCell>
              <TableCell>
                <div
                  className="bg-foreground h-3 rounded-md"
                  style={{
                    width: `${(value / total) * 100}%`,
                    minWidth: "1px",
                  }}
                />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
