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

import { timingDict } from "../config";
import type { Timing } from "../utils";
import { getTimingPhases, getTotalLatency } from "../utils";

export function ResponseTimingTable({
  timing,
  hideInfo = false,
}: {
  timing: Timing;
  hideInfo?: boolean;
}) {
  const total = getTotalLatency(timing);
  const timingPhases = getTimingPhases(timing);
  return (
    <Table>
      <TableCaption>Response Timing</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[120px] md:w-[150px]">Timing</TableHead>
          <TableHead className="w-[120px] md:w-[150px]">Duration</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {Object.entries(timingPhases).map(([key, value]) => {
          const { short, long, description } =
            timingDict[key as keyof typeof timingPhases];
          return (
            <TableRow key={key}>
              <TableCell>
                <div className="flex w-[80px] items-center justify-between gap-2">
                  <p className="text-muted-foreground">{short}</p>
                  {!hideInfo ? (
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
                  ) : null}
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
