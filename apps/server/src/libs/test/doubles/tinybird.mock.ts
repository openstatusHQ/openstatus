// Test double for @openstatus/tinybird, swapped in via --import-map. Overrides
// OSTinybird with a no-network stub backed by `__tinybirdMockData/Calls`, while
// re-exporting the real Tinybird/AuditLog/etc. for code that imports them.
export * from "@openstatus/tinybird-real";

import {
  tinybirdMockCalls as calls,
  tinybirdMockData as data,
} from "./state.ts";

const empty = () => Promise.resolve({ data: [] });

export class OSTinybird {
  get legacy_httpStatus45d() {
    return empty;
  }
  get legacy_tcpStatus45d() {
    return empty;
  }
  get httpListBiweekly() {
    return (params: unknown) => {
      calls.httpListBiweekly.push(params);
      return Promise.resolve({ data: data.httpListBiweekly });
    };
  }
  get httpGetBiweekly() {
    return (params: unknown) => {
      calls.httpGetBiweekly.push(params);
      return Promise.resolve({ data: data.httpGetBiweekly });
    };
  }
  get httpMetricsDaily() {
    return empty;
  }
  get httpMetricsWeekly() {
    return empty;
  }
  get httpMetricsBiweekly() {
    return empty;
  }
  get tcpMetricsDaily() {
    return empty;
  }
  get tcpMetricsWeekly() {
    return empty;
  }
  get tcpMetricsBiweekly() {
    return empty;
  }
  get dnsMetricsDaily() {
    return empty;
  }
  get dnsMetricsWeekly() {
    return empty;
  }
  get dnsMetricsBiweekly() {
    return empty;
  }
}
