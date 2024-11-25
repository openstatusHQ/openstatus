import { Info } from "lucide-react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@openstatus/ui/src/components/popover";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@openstatus/ui/src/components/table";

import { timingDict } from "./config";
import type { Timing } from "./utils";
import { getTimingPhases, getTimingPhasesWidth } from "./utils";

export function ResponseTimingTable({
  timing,
  hideInfo = false,
}: {
  timing: Timing;
  hideInfo?: boolean;
}) {
  const timingPhases = getTimingPhases(timing);
  const timingPhasesWidth = getTimingPhasesWidth(timing);

  return (
    <Table>
      <TableCaption className="mt-2">Response Timing</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[72px] md:w-[150px]">Timing</TableHead>
          <TableHead className="w-[100px] md:w-[150px]">Duration</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {Object.entries(timingPhases).map(([key, value]) => {
          const phase = key as keyof typeof timingPhases;
          const { short, long, description } = timingDict[phase];
          const { preWidth, width } = timingPhasesWidth[phase];

          return (
            <TableRow key={key}>
              <TableCell>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-muted-foreground">{short}</p>
                  {!hideInfo ? (
                    <Popover>
                      <PopoverTrigger className="text-muted-foreground hover:text-foreground data-[state=open]:text-foreground">
                        <Info className="mr-2 h-4 w-4" />
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
              <TableCell className="flex w-full">
                <div
                  style={{
                    width: `${preWidth}%`,
                    minWidth: "1px",
                  }}
                />
                <div
                  className="h-3 rounded-md bg-foreground"
                  style={{
                    width: `${width}%`,
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
