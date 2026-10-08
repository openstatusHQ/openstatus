"use client";

import type { RouterOutputs } from "@openstatus/api";
import type { PrivateLocation } from "@openstatus/db/src/schema";
import { Api, TableProperties } from "@openstatus/icons";
import { getRegionInfo } from "@openstatus/regions";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from "@openstatus/ui/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@openstatus/ui/components/ui/tabs";
import { cn } from "@openstatus/ui/lib/utils";

import { IconCloudProvider } from "@/components/common/icon-cloud-provider";
import { BlockWrapper } from "@/components/content/block-wrapper";
import { TableCellDate } from "@/components/data-table/table-cell-date";
import { TableCellNumber } from "@/components/data-table/table-cell-number";
import { getStatusCodeVariant, textColors } from "@/data/status-codes";
import { formatMilliseconds, formatPercentage } from "@/lib/formatter";

type ResponseLog = RouterOutputs["tinybird"]["get"]["data"][number];

export function DataTableBasics({
  data,
  privateLocations,
}: {
  data: ResponseLog;
  privateLocations?: PrivateLocation[];
}) {
  if (data.type === "http") {
    return (
      <DataTableBasicsHTTP data={data} privateLocations={privateLocations} />
    );
  }
  if (data.type === "tcp") {
    return (
      <DataTableBasicsTCP data={data} privateLocations={privateLocations} />
    );
  }
  if (data.type === "dns") {
    return (
      <DataTableBasicsDNS data={data} privateLocations={privateLocations} />
    );
  }
  if (data.type === "icmp") {
    return (
      <DataTableBasicsICMP data={data} privateLocations={privateLocations} />
    );
  }
  if (data.type === "grpc") {
    return (
      <DataTableBasicsGRPC data={data} privateLocations={privateLocations} />
    );
  }
  return null;
}

export function DataTableBasicsHTTP({
  data,
  privateLocations,
}: {
  data: Extract<ResponseLog, { type: "http" }> & {
    trigger?: "cron" | "api" | "test" | null;
  };
  privateLocations?: PrivateLocation[];
}) {
  const privateLocataion = privateLocations?.find(
    (location) => String(location.id) === String(data.region),
  );
  const regionConfig = getRegionInfo(data.region, {
    location: privateLocataion?.name,
  });
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
          <TableHead className="bg-muted/50 text-muted-foreground font-normal">
            Result
          </TableHead>
          {/* TODO: add colored square like list (see columns) */}
          <TableCell className="max-w-full overflow-x-auto font-mono whitespace-normal">
            <div className="flex items-center gap-2">
              <div
                className={cn("bg-muted h-2.5 w-2.5 rounded-xs", {
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
        {data.id ? (
          <TableRow className="[&>:not(:last-child)]:border-r">
            <TableHead className="bg-muted/50 text-muted-foreground font-normal">
              ID
            </TableHead>
            <TableCell className="max-w-full overflow-x-auto font-mono whitespace-normal">
              {data.id}
            </TableCell>
          </TableRow>
        ) : null}
        <TableRow className="[&>:not(:last-child)]:border-r">
          <TableHead className="bg-muted/50 text-muted-foreground font-normal">
            Timestamp
          </TableHead>
          <TableCell className="max-w-full overflow-x-auto font-mono whitespace-normal">
            <TableCellDate
              value={new Date(data.cronTimestamp)}
              className="text-foreground"
            />
          </TableCell>
        </TableRow>
        <TableRow className="[&>:not(:last-child)]:border-r">
          <TableHead className="bg-muted/50 text-muted-foreground font-normal">
            URL
          </TableHead>
          <TableCell className="max-w-full overflow-x-auto font-mono whitespace-normal">
            {data.url}
          </TableCell>
        </TableRow>
        {/* TODO: store method in TB 🤦 */}
        {/* <TableRow className="[&>:not(:last-child)]:border-r">
        <TableHead className="bg-muted/50 font-normal text-muted-foreground">
            Method
        </TableHead>
        <TableCell className="whitespace-normal font-mono">
            {data?.method}
        </TableCell>
        </TableRow> */}
        <TableRow className="[&>:not(:last-child)]:border-r">
          <TableHead className="bg-muted/50 text-muted-foreground font-normal">
            Status
          </TableHead>
          <TableCell className="max-w-full overflow-x-auto font-mono whitespace-normal">
            <TableCellNumber
              value={data.statusCode}
              className={textColors[getStatusCodeVariant(data.statusCode)]}
            />
          </TableCell>
        </TableRow>
        <TableRow className="[&>:not(:last-child)]:border-r">
          <TableHead className="bg-muted/50 text-muted-foreground font-normal">
            Latency
          </TableHead>
          <TableCell className="max-w-full overflow-x-auto font-mono whitespace-normal">
            <TableCellNumber value={data?.latency} unit="ms" />
          </TableCell>
        </TableRow>
        <TableRow className="[&>:not(:last-child)]:border-r">
          <TableHead className="bg-muted/50 text-muted-foreground font-normal">
            Region
          </TableHead>
          <TableCell className="max-w-full overflow-x-auto font-mono whitespace-normal">
            {regionConfig?.code}{" "}
            <span className="text-muted-foreground text-xs">
              {regionConfig?.location} {regionConfig?.flag}
            </span>
          </TableCell>
        </TableRow>
        <TableRow className="[&>:not(:last-child)]:border-r">
          <TableHead className="bg-muted/50 text-muted-foreground font-normal">
            Cloud Provider
          </TableHead>
          <TableCell className="inline-flex max-w-full overflow-x-auto font-mono whitespace-normal">
            <IconCloudProvider
              provider={regionConfig?.provider}
              className="mt-0.5"
            />
            <span className="text-muted-foreground ml-1">
              {regionConfig?.provider}
            </span>
          </TableCell>
        </TableRow>
        {data.trigger ? (
          <TableRow className="[&>:not(:last-child)]:border-r">
            <TableHead className="bg-muted/50 text-muted-foreground font-normal">
              Trigger
            </TableHead>
            <TableCell className="max-w-full overflow-x-auto font-mono whitespace-normal">
              {data?.trigger}
            </TableCell>
          </TableRow>
        ) : null}
        {data.headers ? (
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
                      <Api className="size-3" />
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
                              <TableHead className="bg-muted/50 text-muted-foreground overflow-x-auto font-normal">
                                {key}
                              </TableHead>
                              <TableCell className="max-w-full overflow-x-auto font-mono whitespace-normal">
                                {value}
                              </TableCell>
                            </TableRow>
                          ),
                        )}
                      </TableBody>
                    </Table>
                  </TabsContent>
                  <TabsContent value="raw">
                    <pre className="bg-muted/50 max-w-full overflow-x-auto rounded-none p-4 font-mono text-sm whitespace-pre-wrap">
                      {JSON.stringify(data?.headers, null, 2)}
                    </pre>
                  </TabsContent>
                </Tabs>
              </TableCell>
            </TableRow>
          </>
        ) : null}
        {data.timing ? (
          <>
            <TableRow>
              <TableHead colSpan={2}>Timing</TableHead>
            </TableRow>
            {Object.entries(data?.timing ?? {}).map(([key, value], index) => (
              <TableRow key={key} className="[&>:not(:last-child)]:border-r">
                <TableHead className="bg-muted/50 text-muted-foreground font-normal">
                  <span className="uppercase">{key}</span>
                </TableHead>
                <TableCell className="max-w-full overflow-x-auto font-mono whitespace-normal">
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
        {data?.message ? (
          <>
            <TableRow>
              <TableHead colSpan={2}>Message</TableHead>
            </TableRow>
            <TableRow>
              <TableCell colSpan={2} className="p-0">
                <pre className="bg-muted/50 max-w-full overflow-x-auto rounded-none p-2 font-mono text-sm whitespace-pre-wrap">
                  {data.message}
                </pre>
              </TableCell>
            </TableRow>
          </>
        ) : null}
        {data.body ? (
          <>
            <TableRow>
              <TableHead colSpan={2}>Body</TableHead>
            </TableRow>
            <TableRow>
              <TableCell colSpan={2} className="p-0">
                <BlockWrapper autoOpen>
                  <pre className="bg-muted/50 max-w-full overflow-x-auto rounded-none p-2 font-mono text-sm whitespace-pre-wrap">
                    {data.body}
                  </pre>
                </BlockWrapper>
              </TableCell>
            </TableRow>
          </>
        ) : null}
        {data.assertions ? (
          <>
            <TableRow>
              <TableHead colSpan={2}>Assertions</TableHead>
            </TableRow>
            <TableRow>
              <TableCell colSpan={2} className="p-0">
                {!data.assertions || data.assertions === "[]" ? (
                  <div className="text-muted-foreground p-2 font-mono text-sm">
                    Default status code 2xx assertion
                  </div>
                ) : (
                  <pre className="bg-muted/50 max-w-full overflow-x-auto rounded-none p-2 font-mono text-sm whitespace-pre-wrap">
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

type BasicsRequestFields = {
  id?: string | null;
  requestStatus?: string | null;
  cronTimestamp: number;
};

type BasicsLocationFields = {
  region: string;
  trigger?: "cron" | "api" | "test" | null;
};

function BasicsTable({ children }: { children: React.ReactNode }) {
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
        {children}
      </TableBody>
    </Table>
  );
}

function BasicsRow({
  label,
  children,
  cellClassName,
}: {
  label: string;
  children: React.ReactNode;
  cellClassName?: string;
}) {
  return (
    <TableRow className="[&>:not(:last-child)]:border-r">
      <TableHead className="bg-muted/50 text-muted-foreground font-normal">
        {label}
      </TableHead>
      <TableCell
        className={cn(
          "max-w-full overflow-x-auto font-mono whitespace-normal",
          cellClassName,
        )}
      >
        {children}
      </TableCell>
    </TableRow>
  );
}

function BasicsRequestRows({ data }: { data: BasicsRequestFields }) {
  return (
    <>
      {/* TODO: add colored square like list (see columns) */}
      <BasicsRow label="Result">
        <div className="flex items-center gap-2">
          <div
            className={cn("bg-muted h-2.5 w-2.5 rounded-xs", {
              "bg-destructive": data?.requestStatus === "error",
              "bg-warning": data?.requestStatus === "degraded",
              "bg-success": data?.requestStatus === "success",
            })}
          />
          <div className="capitalize">{data?.requestStatus ?? "unknown"}</div>
        </div>
      </BasicsRow>
      {data.id ? <BasicsRow label="ID">{data.id}</BasicsRow> : null}
      <BasicsRow label="Timestamp">
        <TableCellDate
          value={new Date(data.cronTimestamp)}
          className="text-foreground"
        />
      </BasicsRow>
    </>
  );
}

function BasicsLocationRows({
  data,
  privateLocations,
}: {
  data: BasicsLocationFields;
  privateLocations?: PrivateLocation[];
}) {
  const privateLocation = privateLocations?.find(
    (location) => String(location.id) === String(data.region),
  );
  const regionConfig = getRegionInfo(data.region, {
    location: privateLocation?.name,
  });

  return (
    <>
      <BasicsRow label="Region">
        {regionConfig?.flag} {regionConfig?.code}{" "}
        <span className="text-muted-foreground">{regionConfig?.location}</span>
      </BasicsRow>
      <BasicsRow
        label="Cloud Provider"
        cellClassName="inline-flex whitespace-normal"
      >
        <IconCloudProvider
          provider={regionConfig?.provider}
          className="mt-0.5"
        />
        <span className="text-muted-foreground ml-1">
          {regionConfig?.provider}
        </span>
      </BasicsRow>
      {data.trigger ? (
        <BasicsRow label="Trigger">{data?.trigger}</BasicsRow>
      ) : null}
    </>
  );
}

function BasicsErrorMessageRows({
  errorMessage,
}: {
  errorMessage?: string | null;
}) {
  if (!errorMessage) return null;

  return (
    <>
      <TableRow>
        <TableHead colSpan={2}>Error Message</TableHead>
      </TableRow>
      <TableRow>
        <TableCell colSpan={2} className="p-0">
          <pre className="bg-muted/50 max-w-full overflow-x-auto rounded-none p-2 font-mono text-sm whitespace-pre-wrap">
            {errorMessage}
          </pre>
        </TableCell>
      </TableRow>
    </>
  );
}

export function DataTableBasicsTCP({
  data,
  privateLocations,
}: {
  data: Extract<ResponseLog, { type: "tcp" }> & {
    trigger?: "cron" | "api" | "test" | null;
  };
  privateLocations?: PrivateLocation[];
}) {
  return (
    <BasicsTable>
      <BasicsRequestRows data={data} />
      <BasicsRow label="URI">{data.uri}</BasicsRow>
      <BasicsRow label="Latency">
        <TableCellNumber value={data?.latency} unit="ms" />
      </BasicsRow>
      <BasicsLocationRows data={data} privateLocations={privateLocations} />
      <BasicsErrorMessageRows errorMessage={data?.errorMessage} />
    </BasicsTable>
  );
}

export function DataTableBasicsICMP({
  data,
  privateLocations,
}: {
  data: Extract<ResponseLog, { type: "icmp" }> & {
    trigger?: "cron" | "api" | "test" | null;
  };
  privateLocations?: PrivateLocation[];
}) {
  const packetLoss =
    data.packetsSent > 0
      ? (data.packetsSent - data.packetsReceived) / data.packetsSent
      : 0;

  return (
    <BasicsTable>
      <BasicsRequestRows data={data} />
      <BasicsRow label="Host">{data.uri}</BasicsRow>
      <BasicsRow label="Latency (avg)">
        <TableCellNumber value={data?.latency} unit="ms" />
      </BasicsRow>
      <BasicsRow label="Latency (min / max)">
        {formatMilliseconds(data.latencyMin)} /{" "}
        {formatMilliseconds(data.latencyMax)}
      </BasicsRow>
      <BasicsRow label="Packets">
        {data.packetsReceived} / {data.packetsSent} received
      </BasicsRow>
      <BasicsRow label="Packet Loss">{formatPercentage(packetLoss)}</BasicsRow>
      <BasicsLocationRows data={data} privateLocations={privateLocations} />
      <BasicsErrorMessageRows errorMessage={data?.errorMessage} />
    </BasicsTable>
  );
}

export function DataTableBasicsGRPC({
  data,
  privateLocations,
}: {
  data: Extract<ResponseLog, { type: "grpc" }> & {
    trigger?: "cron" | "api" | "test" | null;
  };
  privateLocations?: PrivateLocation[];
}) {
  return (
    <BasicsTable>
      <BasicsRequestRows data={data} />
      <BasicsRow label="Host:Port">{data.uri}</BasicsRow>
      <BasicsRow label="Service">
        {data.service ? (
          data.service
        ) : (
          <span className="text-muted-foreground">overall server health</span>
        )}
      </BasicsRow>
      <BasicsRow label="Serving Status">
        {data.servingStatus ?? (
          <span className="text-muted-foreground">no answer</span>
        )}
      </BasicsRow>
      <BasicsRow label="gRPC Code">
        {data.grpcCode ?? <span className="text-muted-foreground">N/A</span>}
      </BasicsRow>
      <BasicsRow label="Latency">
        <TableCellNumber value={data?.latency} unit="ms" />
      </BasicsRow>
      <BasicsLocationRows data={data} privateLocations={privateLocations} />
      <BasicsErrorMessageRows errorMessage={data?.errorMessage} />
    </BasicsTable>
  );
}

export function DataTableBasicsDNS({
  data,
  privateLocations,
}: {
  data: Extract<ResponseLog, { type: "dns" }> & {
    trigger?: "cron" | "api" | "test" | null;
  };
  privateLocations?: PrivateLocation[];
}) {
  return (
    <BasicsTable>
      <BasicsRequestRows data={data} />
      <BasicsRow label="URI">{data.uri}</BasicsRow>
      <BasicsRow label="Latency">
        <TableCellNumber value={data?.latency} unit="ms" />
      </BasicsRow>
      <BasicsLocationRows data={data} privateLocations={privateLocations} />
      {data?.records ? (
        <>
          <TableRow>
            <TableHead colSpan={2}>Records</TableHead>
          </TableRow>
          <TableRow className="hover:bg-transparent">
            <TableCell colSpan={2} className="p-0">
              <Tabs defaultValue="table" className="w-full gap-0">
                <TabsList className="w-full justify-start rounded-none border-b px-2">
                  <TabsTrigger value="table">
                    <TableProperties className="size-3 rotate-180" />
                  </TabsTrigger>
                  <TabsTrigger value="raw">
                    <Api className="size-3" />
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="table">
                  <Table className="table-fixed">
                    <colgroup>
                      <col className="w-1/3" />
                      <col className="w-2/3" />
                    </colgroup>
                    <TableBody>
                      {Object.entries(data?.records ?? {}).map(
                        ([key, value]) => (
                          <TableRow
                            key={key}
                            className="[&>:not(:last-child)]:border-r"
                          >
                            <TableHead className="bg-muted/50 text-muted-foreground overflow-x-auto font-normal">
                              {key.toUpperCase()}
                            </TableHead>
                            <TableCell className="max-w-full overflow-x-auto font-mono whitespace-normal">
                              {Array.isArray(value) ? value.join(", ") : value}
                            </TableCell>
                          </TableRow>
                        ),
                      )}
                    </TableBody>
                  </Table>
                </TabsContent>
                <TabsContent value="raw">
                  <pre className="bg-muted/50 max-w-full overflow-x-auto rounded-none p-4 font-mono text-sm whitespace-pre-wrap">
                    {JSON.stringify(data?.records, null, 2)}
                  </pre>
                </TabsContent>
              </Tabs>
            </TableCell>
          </TableRow>
        </>
      ) : null}
      {data?.errorMessage ? (
        <>
          <TableRow>
            <TableHead colSpan={2}>Error Message</TableHead>
          </TableRow>
          <TableRow>
            <TableCell colSpan={2} className="p-0">
              <pre className="bg-muted/50 max-w-full overflow-x-auto rounded-none p-2 font-mono text-sm whitespace-pre-wrap">
                {data.errorMessage}
              </pre>
            </TableCell>
          </TableRow>
        </>
      ) : null}
      {data.assertions ? (
        <>
          <TableRow>
            <TableHead colSpan={2}>Assertions</TableHead>
          </TableRow>
          <TableRow>
            <TableCell colSpan={2} className="p-0">
              {!data.assertions || data.assertions === "[]" ? (
                <div className="text-muted-foreground p-2 font-mono text-sm">
                  No assertions
                </div>
              ) : (
                <pre className="bg-muted/50 max-w-full overflow-x-auto rounded-none p-2 font-mono text-sm whitespace-pre-wrap">
                  {JSON.stringify(data.assertions, null, 2)}
                </pre>
              )}
            </TableCell>
          </TableRow>
        </>
      ) : null}
    </BasicsTable>
  );
}
