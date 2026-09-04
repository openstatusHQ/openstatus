import type { Assertion } from "@openstatus/assertions";
import {
  HeaderAssertion,
  StatusAssertion,
  TextBodyAssertion,
} from "@openstatus/assertions";
import { ServiceError } from "@openstatus/services";
import { assertMonitorUrlSafe } from "@openstatus/services/monitor";
import type { z } from "zod";

import { OpenStatusApiError } from "@/libs/errors";

import type { assertion, assertionsSchema } from "./schema";

/**
 * These routes write to the DB directly instead of going through
 * `@openstatus/services`, so the SSRF guard has to be invoked by hand.
 */
export function assertSafeMonitorUrl(args: {
  jobType: string;
  url: string;
}): void {
  try {
    assertMonitorUrlSafe(args);
  } catch (err) {
    if (err instanceof ServiceError) {
      throw new OpenStatusApiError({
        code: "BAD_REQUEST",
        message: err.message,
      });
    }
    throw err;
  }
}

/**
 * The v1 API is legacy and frozen to the monitor types it already shipped:
 * `POST /v1/monitor` refuses anything but http/tcp, so a newer type can only
 * reach these routes on a monitor created elsewhere. Running one here would
 * dispatch a probe the route cannot describe back to the caller. New types are
 * served by the ConnectRPC API (`TriggerMonitor`) instead.
 */
const LEGACY_RUNNABLE_JOB_TYPES = ["http", "tcp"];

export function assertLegacyRunnableJobType(jobType: string): void {
  if (!LEGACY_RUNNABLE_JOB_TYPES.includes(jobType)) {
    throw new OpenStatusApiError({
      code: "BAD_REQUEST",
      message: `Running a '${jobType}' monitor is not supported by the v1 API. Use the ConnectRPC MonitorService.TriggerMonitor instead.`,
    });
  }
}

export const getAssertions = (
  assertions: z.infer<typeof assertion>[],
): Assertion[] => {
  const assert: Assertion[] = [];

  for (const a of assertions) {
    if (a.type === "header") {
      assert.push(new HeaderAssertion({ ...a, version: "v1" }));
    }
    if (a.type === "textBody") {
      assert.push(new TextBodyAssertion({ ...a, version: "v1" }));
    }
    if (a.type === "status") {
      assert.push(new StatusAssertion({ ...a, version: "v1" }));
    }
  }
  return assert;
};

export const getAssertionNew = (
  assertions: z.infer<typeof assertionsSchema>[],
): Assertion[] => {
  const assert: Assertion[] = [];

  for (const a of assertions) {
    if (a.kind === "header") {
      const { kind, ...rest } = a;
      assert.push(
        new HeaderAssertion({
          ...rest,
          type: "header",
          version: "v1",
        }),
      );
    }
    if (a.kind === "textBody") {
      const { kind, ...rest } = a;

      assert.push(
        new TextBodyAssertion({ ...rest, type: "textBody", version: "v1" }),
      );
    }
    if (a.kind === "statusCode") {
      const { kind, ...rest } = a;
      assert.push(
        new StatusAssertion({ ...rest, type: "status", version: "v1" }),
      );
    }
  }
  return assert;
};
