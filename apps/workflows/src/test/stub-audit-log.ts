import { type MockInstance, vi } from "vitest";

import { checkerAudit } from "../utils/audit-log";

type Publish = typeof checkerAudit.publishAuditLog;

/**
 * `publishAuditLog` is a getter that builds the ingest function on each read,
 * so it has to be spied as an accessor. vitest only types the `"get"` form for
 * non-function properties; the key is widened here, safe because the getter
 * really exists on the instance's prototype.
 */
export function stubPublishAuditLog(
  impl: Publish = () =>
    Promise.resolve({ successful_rows: 0, quarantined_rows: 0 }),
): MockInstance {
  const target = checkerAudit as unknown as { publishAuditLog: unknown };
  return vi
    .spyOn(target, "publishAuditLog", "get")
    .mockReturnValue(vi.fn(impl));
}
