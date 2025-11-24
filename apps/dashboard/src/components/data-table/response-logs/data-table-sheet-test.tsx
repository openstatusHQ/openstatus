"use client";

import {
  DataTableSheet,
  DataTableSheetContent,
  DataTableSheetHeader,
  DataTableSheetTitle,
} from "@/components/data-table/data-table-sheet";
import type { RouterOutputs } from "@openstatus/api";
import { DataTableBasics } from "./data-table-basics";

type TestTCP = RouterOutputs["checker"]["testTcp"];
type TestHTTP = RouterOutputs["checker"]["testHttp"];
type TestDNS = RouterOutputs["checker"]["testDns"];
type Monitor = NonNullable<RouterOutputs["monitor"]["get"]>;

export function DataTableSheetTest({
  data,
  monitor,
  onClose,
}: {
  data: TestTCP | TestHTTP | TestDNS | null;
  monitor: Monitor;
  onClose: () => void;
}) {
  if (!data) return null;

  const _data = mapping(data, monitor);

  if (!_data) return null;

  return (
    <DataTableSheet defaultOpen>
      {/* NOTE: we are using onCloseAutoFocus to reset with a delay to avoid abrupt closing of the sheet */}
      <DataTableSheetContent className="sm:max-w-lg" onCloseAutoFocus={onClose}>
        <DataTableSheetHeader className="px-2">
          <DataTableSheetTitle>Test Result</DataTableSheetTitle>
        </DataTableSheetHeader>
        <DataTableBasics data={_data} />
      </DataTableSheetContent>
    </DataTableSheet>
  );
}

function mapping(data: TestTCP | TestHTTP | TestDNS, monitor: Monitor) {
  switch (data.type) {
    case "http":
      return {
        id: null,
        trigger: null,
        timestamp: data.timestamp,
        cronTimestamp: data.timestamp,
        type: data.type,
        requestStatus: "success",
        statusCode: data.status,
        headers: data.headers,
        region: data.region,
        latency: data.latency,
        timing: {
          dns: data.timing.dnsDone - data.timing.dnsStart,
          connect: data.timing.connectDone - data.timing.connectStart,
          tls: data.timing.tlsHandshakeDone - data.timing.tlsHandshakeStart,
          ttfb: data.timing.firstByteDone - data.timing.firstByteStart,
          transfer: data.timing.transferDone - data.timing.transferStart,
        },
        url: monitor.url,
        workspaceId: String(monitor.workspaceId),
        error: false,
        monitorId: String(monitor.id),
        assertions: monitor.assertions ?? null,
        message: null,
        body: data.body ?? null,
      } as const;
    case "tcp":
      return {
        id: null,
        trigger: null,
        timestamp: data.timestamp,
        cronTimestamp: data.timestamp,
        region: data.region,
        type: data.type,
        requestStatus: "success",
        error: false,
        latency: data.latency ?? 0,
        uri: monitor.url,
        monitorId: String(monitor.id),
        errorMessage: null,
        assertions: null,
      } as const;
    // FIXM: add DNS props
    case "dns":
      return {
        id: null,
        trigger: null,
        timestamp: data.timestamp,
        cronTimestamp: data.timestamp,
        region: data.region,
        type: data.type,
        requestStatus: "success",
        monitorId: String(monitor.id),
        error: false,
        uri: monitor.url,
        latency: data.latency ?? 0,
        records: data.records,
        errorMessage: null,
        assertions: null,
      } as const;
    default:
      return null;
  }
}
