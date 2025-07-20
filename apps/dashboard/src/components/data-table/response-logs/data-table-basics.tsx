"use client";

import { TableCellDate } from "@/components/data-table/table-cell-date";
import { TableCellNumber } from "@/components/data-table/table-cell-number";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Braces, TableProperties } from "lucide-react";
import type { RouterOutputs } from "@openstatus/api";
import { getStatusCodeVariant, textColors } from "@/data/status-codes";
import { cn } from "@/lib/utils";
import { formatMilliseconds, formatPercentage } from "@/lib/formatter";
import { flyRegionsDict } from "@openstatus/utils";

type ResponseLog = RouterOutputs["tinybird"]["get"]["data"][number];

export function DataTableBasics({ data }: { data: ResponseLog }) {
  const regionConfig = flyRegionsDict[data.region];
  return (
    <Table className="table-fixed">
      <colgroup>
        <col className="w-1/3" />
        <col className="w-2/3" />
      </colgroup>
      <TableBody>
        <TableRow>
          <TableHead colSpan={2}>Request</TableHead>
        </TableRow>
        <TableRow className="[&>:not(:last-child)]:border-r">
          <TableHead className="bg-muted/50 font-normal text-muted-foreground">
            Result
          </TableHead>
          {/* TODO: add colored square like list (see columns) */}
          <TableCell className="whitespace-normal font-mono overflow-x-auto max-w-full">
            <div className="flex items-center gap-2">
              <div
                className={cn("h-2.5 w-2.5 rounded-[2px] bg-muted", {
                  "bg-destructive": data?.requestStatus === "error",
                  "bg-warning": data?.requestStatus === "degraded",
                  "bg-success": data?.requestStatus === "success",
                })}
              />
              <div className="capitalize">
                {data?.requestStatus ?? "unknown"}
              </div>
            </div>
          </TableCell>
        </TableRow>
        <TableRow className="[&>:not(:last-child)]:border-r">
          <TableHead className="bg-muted/50 font-normal text-muted-foreground">
            ID
          </TableHead>
          <TableCell className="whitespace-normal font-mono overflow-x-auto max-w-full">
            {data.id}
          </TableCell>
        </TableRow>
        <TableRow className="[&>:not(:last-child)]:border-r">
          <TableHead className="bg-muted/50 font-normal text-muted-foreground">
            Timestamp
          </TableHead>
          <TableCell className="whitespace-normal font-mono overflow-x-auto max-w-full">
            <TableCellDate
              value={new Date(data.cronTimestamp)}
              className="text-foreground"
            />
          </TableCell>
        </TableRow>
        {data.type === "http" ? (
          <TableRow className="[&>:not(:last-child)]:border-r">
            <TableHead className="bg-muted/50 font-normal text-muted-foreground">
              URL
            </TableHead>
            <TableCell className="whitespace-normal font-mono overflow-x-auto max-w-full">
              {data.url}
            </TableCell>
          </TableRow>
        ) : null}
        {data.type === "tcp" ? (
          <TableRow className="[&>:not(:last-child)]:border-r">
            <TableHead className="bg-muted/50 font-normal text-muted-foreground">
              URI
            </TableHead>
            <TableCell className="whitespace-normal font-mono overflow-x-auto max-w-full">
              {data.uri}
            </TableCell>
          </TableRow>
        ) : null}
        {/* TODO: store method in TB 🤦 */}
        {/* <TableRow className="[&>:not(:last-child)]:border-r">
          <TableHead className="bg-muted/50 font-normal text-muted-foreground">
            Method
          </TableHead>
          <TableCell className="whitespace-normal font-mono">
            {data?.method}
          </TableCell>
        </TableRow> */}
        {data.type === "http" ? (
          <TableRow className="[&>:not(:last-child)]:border-r">
            <TableHead className="bg-muted/50 font-normal text-muted-foreground">
              Status
            </TableHead>
            <TableCell className="whitespace-normal font-mono overflow-x-auto max-w-full">
              <TableCellNumber
                value={data.statusCode}
                className={textColors[getStatusCodeVariant(data.statusCode)]}
              />
            </TableCell>
          </TableRow>
        ) : null}
        <TableRow className="[&>:not(:last-child)]:border-r">
          <TableHead className="bg-muted/50 font-normal text-muted-foreground">
            Latency
          </TableHead>
          <TableCell className="whitespace-normal font-mono overflow-x-auto max-w-full">
            <TableCellNumber value={data?.latency} unit="ms" />
          </TableCell>
        </TableRow>
        <TableRow className="[&>:not(:last-child)]:border-r">
          <TableHead className="bg-muted/50 font-normal text-muted-foreground">
            Region
          </TableHead>
          <TableCell className="whitespace-normal font-mono overflow-x-auto max-w-full">
            {regionConfig?.flag} {regionConfig?.code}{" "}
            <span className="text-muted-foreground">
              {regionConfig?.location}
            </span>
          </TableCell>
        </TableRow>
        <TableRow className="[&>:not(:last-child)]:border-r">
          <TableHead className="bg-muted/50 font-normal text-muted-foreground">
            Trigger
          </TableHead>
          <TableCell className="whitespace-normal font-mono overflow-x-auto max-w-full">
            {data?.trigger}
          </TableCell>
        </TableRow>
        {data.type === "http" && data.headers ? (
          <>
            <TableRow>
              <TableHead colSpan={2}>Headers</TableHead>
            </TableRow>
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={2} className="p-0">
                <Tabs defaultValue="table" className="w-full gap-0">
                  <TabsList className="w-full justify-start rounded-none border-b px-2">
                    <TabsTrigger value="table">
                      <TableProperties className="size-3 rotate-180" />
                    </TabsTrigger>
                    <TabsTrigger value="raw">
                      <Braces className="size-3" />
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="table">
                    <Table className="table-fixed">
                      <colgroup>
                        <col className="w-1/3" />
                        <col className="w-2/3" />
                      </colgroup>
                      <TableBody>
                        {Object.entries(data?.headers ?? {}).map(
                          ([key, value]) => (
                            <TableRow
                              key={key}
                              className="[&>:not(:last-child)]:border-r"
                            >
                              <TableHead className="bg-muted/50 font-normal text-muted-foreground">
                                {key}
                              </TableHead>
                              <TableCell className="whitespace-normal font-mono overflow-x-auto max-w-full">
                                {value}
                              </TableCell>
                            </TableRow>
                          )
                        )}
                      </TableBody>
                    </Table>
                  </TabsContent>
                  <TabsContent value="raw">
                    <pre className="whitespace-pre-wrap rounded-none bg-muted/50 p-4 font-mono text-sm overflow-x-auto max-w-full">
                      {JSON.stringify(data?.headers, null, 2)}
                    </pre>
                  </TabsContent>
                </Tabs>
              </TableCell>
            </TableRow>
          </>
        ) : null}
        {data.type === "http" && data.timing ? (
          <>
            <TableRow>
              <TableHead colSpan={2}>Timing</TableHead>
            </TableRow>
            {Object.entries(data?.timing ?? {}).map(([key, value], index) => (
              <TableRow key={key} className="[&>:not(:last-child)]:border-r">
                <TableHead className="bg-muted/50 font-normal text-muted-foreground">
                  <span className="uppercase">{key}</span>
                </TableHead>
                <TableCell className="whitespace-normal font-mono overflow-x-auto max-w-full">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1">
                      <span className="text-muted-foreground">
                        {formatPercentage(value / (data?.latency || 100))}
                      </span>
                    </div>
                    <div className="flex w-full flex-1 items-center justify-end gap-2">
                      <span className="text-muted-foreground text-nowrap">
                        {formatMilliseconds(value)}
                      </span>
                      <div
                        className="h-4"
                        style={{
                          width: `${(value / (data?.latency || 100)) * 100}%`,
                          backgroundColor: `var(--chart-${index + 1})`,
                        }}
                      />
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </>
        ) : null}
        {data.type === "http" && data?.message ? (
          <>
            <TableRow>
              <TableHead colSpan={2}>Message</TableHead>
            </TableRow>
            <TableRow>
              <TableCell colSpan={2} className="p-0">
                <pre className="whitespace-pre-wrap rounded-none bg-muted/50 p-2 font-mono text-sm overflow-x-auto max-w-full">
                  {data.message}
                </pre>
              </TableCell>
            </TableRow>
          </>
        ) : null}
        {data.type === "tcp" && data?.errorMessage ? (
          <>
            <TableRow>
              <TableHead colSpan={2}>Error Message</TableHead>
            </TableRow>
            <TableRow>
              <TableCell colSpan={2} className="p-0">
                <pre className="whitespace-pre-wrap rounded-none bg-muted/50 p-2 font-mono text-sm overflow-x-auto max-w-full">
                  {data.errorMessage}
                </pre>
              </TableCell>
            </TableRow>
          </>
        ) : null}
        {data.type === "http" ? (
          <>
            <TableRow>
              <TableHead colSpan={2}>Assertions</TableHead>
            </TableRow>
            <TableRow>
              <TableCell colSpan={2} className="p-0">
                {!data.assertions || data.assertions === "[]" ? (
                  <div className="text-muted-foreground text-sm font-mono p-2">
                    Default status code 2xx assertion
                  </div>
                ) : (
                  <pre className="whitespace-pre-wrap rounded-none bg-muted/50 p-2 font-mono text-sm overflow-x-auto max-w-full">
                    {JSON.stringify(data.assertions, null, 2)}
                  </pre>
                )}
              </TableCell>
            </TableRow>
          </>
        ) : null}
      </TableBody>
    </Table>
  );
}
