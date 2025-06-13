"use client";

import { DataTable as DefaultDataTable } from "@/components/ui/data-table/data-table";
import { ResponseLog } from "@/data/response-logs";
import { columns } from "./columns";
import {
  DataTableSheet,
  DataTableSheetContent,
  DataTableSheetTitle,
  DataTableSheetFooter,
  DataTableSheetHeader,
} from "@/components/data-table/data-table-sheet";
import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Braces, Share, TableProperties } from "lucide-react";
import { regions } from "@/data/regions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTablePagination } from "@/components/ui/data-table/data-table-pagination";
import { TableCellDate } from "@/components/data-table/table-cell-date";
import { TableCellNumber } from "@/components/data-table/table-cell-number";
import { statusCodes } from "@/data/status-codes";
import { Separator } from "@/components/ui/separator";
import { ResponseLogsDataTableToolbar } from "@/components/data-table/response-logs/data-table-toolbar";

export function DataTable({ data }: { data: ResponseLog[] }) {
  // TODO: use rowSelection from tanstack-table
  const [selectedRow, setSelectedRow] = useState<ResponseLog | null>(null);
  const regionConfig = regions.find(
    (region) => region.code === selectedRow?.region
  );
  const statusConfig = statusCodes.find(
    (status) => status.code === selectedRow?.status
  );

  return (
    <>
      <DefaultDataTable
        columns={columns}
        data={data}
        // NOTE: example of how to use rowSelection from tanstack-table
        //   <Checkbox
        //   checked={row.getIsSelected()}
        //   onCheckedChange={(value) => row.toggleSelected(!!value)}
        // />
        onRowClick={(row) => setSelectedRow(row.original)}
        paginationComponent={DataTablePagination}
        toolbarComponent={ResponseLogsDataTableToolbar}
      />
      <DataTableSheet
        open={!!selectedRow}
        onOpenChange={() => setSelectedRow(null)}
      >
        <DataTableSheetContent>
          <DataTableSheetHeader className="px-2">
            <DataTableSheetTitle>Response Logs</DataTableSheetTitle>
          </DataTableSheetHeader>
          <Table>
            <TableBody>
              <TableRow>
                <TableHead colSpan={2}>Request</TableHead>
              </TableRow>
              <TableRow className="[&>:not(:last-child)]:border-r">
                <TableHead className="bg-muted/50 text-muted-foreground font-normal">
                  Timestamp
                </TableHead>
                <TableCell className="font-mono whitespace-normal">
                  <TableCellDate
                    value={new Date(selectedRow?.timestamp ?? 0)}
                    className="text-foreground"
                  />
                </TableCell>
              </TableRow>
              <TableRow className="[&>:not(:last-child)]:border-r">
                <TableHead className="bg-muted/50 text-muted-foreground font-normal">
                  URL
                </TableHead>
                <TableCell className="font-mono whitespace-normal">
                  {selectedRow?.url}
                </TableCell>
              </TableRow>
              <TableRow className="[&>:not(:last-child)]:border-r">
                <TableHead className="bg-muted/50 text-muted-foreground font-normal">
                  Method
                </TableHead>
                <TableCell className="font-mono whitespace-normal">
                  {selectedRow?.method}
                </TableCell>
              </TableRow>
              <TableRow className="[&>:not(:last-child)]:border-r">
                <TableHead className="bg-muted/50 text-muted-foreground font-normal">
                  Status
                </TableHead>
                <TableCell className="font-mono whitespace-normal">
                  <TableCellNumber
                    value={selectedRow?.status}
                    className={statusConfig?.text}
                  />
                </TableCell>
              </TableRow>
              <TableRow className="[&>:not(:last-child)]:border-r">
                <TableHead className="bg-muted/50 text-muted-foreground font-normal">
                  Latency
                </TableHead>
                <TableCell className="font-mono whitespace-normal">
                  <TableCellNumber value={selectedRow?.latency} unit="ms" />
                </TableCell>
              </TableRow>
              <TableRow className="[&>:not(:last-child)]:border-r">
                <TableHead className="bg-muted/50 text-muted-foreground font-normal">
                  Region
                </TableHead>
                <TableCell className="font-mono whitespace-normal">
                  {regionConfig?.flag} {regionConfig?.code}{" "}
                  <span className="text-muted-foreground">
                    {regionConfig?.location}
                  </span>
                </TableCell>
              </TableRow>
              <TableRow>
                <TableHead colSpan={2}>Headers</TableHead>
              </TableRow>
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={2} className="p-0">
                  <Tabs defaultValue="table" className="w-full gap-0">
                    <TabsList className="w-full justify-start border-b rounded-none px-2">
                      <TabsTrigger value="table">
                        <TableProperties className="size-3 rotate-180" />
                      </TabsTrigger>
                      <TabsTrigger value="raw">
                        <Braces className="size-3" />
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent value="table">
                      <Table>
                        <TableBody>
                          {Object.entries(selectedRow?.headers ?? {}).map(
                            ([key, value]) => (
                              <TableRow
                                key={key}
                                className="[&>:not(:last-child)]:border-r"
                              >
                                <TableHead className="bg-muted/50 text-muted-foreground font-normal">
                                  {key}
                                </TableHead>
                                <TableCell className="font-mono whitespace-normal">
                                  {value}
                                </TableCell>
                              </TableRow>
                            )
                          )}
                        </TableBody>
                      </Table>
                    </TabsContent>
                    <TabsContent value="raw">
                      <pre className="p-4 bg-muted/50 rounded-none font-mono text-sm whitespace-pre-wrap">
                        {JSON.stringify(selectedRow?.headers, null, 2)}
                      </pre>
                    </TabsContent>
                  </Tabs>
                </TableCell>
              </TableRow>
              <TableRow>
                <TableHead colSpan={2}>Timing</TableHead>
              </TableRow>
              {Object.entries(selectedRow?.timing ?? {}).map(
                ([key, value], index) => (
                  <TableRow
                    key={key}
                    className="[&>:not(:last-child)]:border-r"
                  >
                    <TableHead className="bg-muted/50 text-muted-foreground font-normal">
                      <span className="uppercase">{key}</span>
                    </TableHead>
                    <TableCell className="font-mono whitespace-normal">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex-1">
                          <span className="text-muted-foreground">
                            {new Intl.NumberFormat("en-US", {
                              maximumFractionDigits: 2,
                            }).format(
                              (value / (selectedRow?.latency || 100)) * 100
                            )}
                            %
                          </span>
                        </div>
                        <div className="flex-1 flex items-center justify-end gap-2 w-full">
                          <span className="text-muted-foreground">
                            {value}ms
                          </span>
                          <div
                            className="h-4"
                            style={{
                              width: `${
                                (value / (selectedRow?.latency || 100)) * 100
                              }%`,
                              backgroundColor: `var(--chart-${index + 1})`,
                            }}
                          />
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              )}
              {selectedRow?.message && (
                <>
                  <TableRow>
                    <TableHead colSpan={2}>Message</TableHead>
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={2} className="p-0">
                      <pre className="p-4 bg-muted/50 rounded-none font-mono text-sm whitespace-pre-wrap">
                        {selectedRow?.message}
                      </pre>
                    </TableCell>
                  </TableRow>
                </>
              )}
              {/* TODO: add assertions */}
            </TableBody>
          </Table>
          <Separator />
          <DataTableSheetFooter>
            <Button variant="outline">
              <Share />
              Share
            </Button>
          </DataTableSheetFooter>
        </DataTableSheetContent>
      </DataTableSheet>
    </>
  );
}
