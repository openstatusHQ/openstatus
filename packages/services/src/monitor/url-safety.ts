import { assertSafeUrlSync } from "@openstatus/utils";

import { ValidationError } from "../errors";

/**
 * Reject monitor URLs pointing at private/internal infrastructure.
 *
 * Only `http` is checked: TCP takes `host:port` and DNS a bare hostname,
 * neither of which parses as a URL, and TCP documents private targets as a
 * supported input.
 */
export function assertMonitorUrlSafe(args: {
  jobType: string;
  url: string;
}): void {
  if (args.jobType !== "http") return;

  try {
    assertSafeUrlSync(args.url);
  } catch (err) {
    throw new ValidationError(
      err instanceof Error ? err.message : "Invalid URL",
      err,
    );
  }
}
