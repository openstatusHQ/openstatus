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
type Monitor = NonNullable<RouterOutputs["monitor"]["get"]>;

export function DataTableSheetTest({
  data,
  monitor,
  onClose,
}: {
  data: TestTCP | TestHTTP | null;
  monitor: Monitor;
  onClose: () => void;
}) {
  if (!data) return null;

  return (
    <DataTableSheet defaultOpen>
      {/* NOTE: we are using onCloseAutoFocus to reset with a delay to avoid abrupt closing of the sheet */}
      <DataTableSheetContent className="sm:max-w-lg" onCloseAutoFocus={onClose}>
        <DataTableSheetHeader className="px-2">
          <DataTableSheetTitle>Test Result</DataTableSheetTitle>
        </DataTableSheetHeader>
        <DataTableBasics
          data={
            data.type === "http"
              ? {
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
                    tls:
                      data.timing.tlsHandshakeDone -
                      data.timing.tlsHandshakeStart,
                    ttfb:
                      data.timing.firstByteDone - data.timing.firstByteStart,
                    transfer:
                      data.timing.transferDone - data.timing.transferStart,
                  },
                  url: monitor.url,
                  workspaceId: String(monitor.workspaceId),
                  error: false,
                  monitorId: String(monitor.id),
                  assertions: monitor.assertions,
                  message: null,
                }
              : {
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
                }
          }
        />
      </DataTableSheetContent>
    </DataTableSheet>
  );
}
