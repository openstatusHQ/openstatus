import type { JsonValue } from "@bufbuild/protobuf";
import { Code, ConnectError } from "@connectrpc/connect";
import { errorFromJson } from "@connectrpc/connect/protocol-connect";
import { ErrorCodes, errorDocsUrl } from "@openstatus/error";
import {
  BadRequestSchema,
  ErrorInfoSchema,
  RetryInfoSchema,
} from "@openstatus/proto/google/rpc";
import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

import {
  ERROR_CODE_TO_CONNECT,
  ERROR_DOMAIN,
  ErrorReason,
  connectCodeToErrorCode,
  connectErrorToJson,
  rpcError,
  withErrorInfo,
} from "./rpc";

const info = (err: ConnectError) => err.findDetails(ErrorInfoSchema)[0];

describe("errorDocsUrl", () => {
  test("anchors on the lowercase, hyphenated code", () => {
    expect(errorDocsUrl("SERVICE_UNAVAILABLE")).toBe(
      "https://www.openstatus.dev/docs/reference/api-errors#service-unavailable",
    );
    expect(errorDocsUrl("NOT_FOUND")).toBe(
      "https://www.openstatus.dev/docs/reference/api-errors#not-found",
    );
  });

  test("every v1 code resolves to a distinct anchor", () => {
    const anchors = new Set(ErrorCodes.map((c) => errorDocsUrl(c)));
    expect(anchors.size).toBe(ErrorCodes.length);
  });
});

describe("rpcError", () => {
  test("attaches google.rpc.ErrorInfo with reason, domain and metadata", () => {
    const err = rpcError({
      code: Code.NotFound,
      reason: ErrorReason.MONITOR_NOT_FOUND,
      message: "Monitor not found",
      metadata: { monitorId: "42" },
    });
    expect(err).toBeInstanceOf(ConnectError);
    expect(err.code).toBe(Code.NotFound);
    expect(err.rawMessage).toBe("Monitor not found");
    expect(info(err)).toMatchObject({
      reason: "MONITOR_NOT_FOUND",
      domain: ERROR_DOMAIN,
      metadata: { monitorId: "42" },
    });
  });

  test("keeps the cause off the wire but on the error", () => {
    const cause = new Error("db exploded");
    const err = rpcError({
      code: Code.Internal,
      reason: ErrorReason.INTERNAL_SERVER_ERROR,
      message: "Internal",
      cause,
    });
    expect(err.cause).toBe(cause);
    expect(connectErrorToJson(err)).not.toHaveProperty("cause");
  });

  test("retryAfterSeconds adds google.rpc.RetryInfo, never below one second", () => {
    const err = rpcError({
      code: Code.Unavailable,
      reason: ErrorReason.SERVICE_UNAVAILABLE,
      message: "busy",
      retryAfterSeconds: 0.2,
    });
    const [retry] = err.findDetails(RetryInfoSchema);
    expect(retry.retryDelay?.seconds).toBe(1n);

    const five = rpcError({
      code: Code.Unavailable,
      reason: ErrorReason.SERVICE_UNAVAILABLE,
      message: "busy",
      retryAfterSeconds: 5,
    });
    expect(five.findDetails(RetryInfoSchema)[0].retryDelay?.seconds).toBe(5n);
  });

  test("fieldViolations add google.rpc.BadRequest", () => {
    const err = rpcError({
      code: Code.InvalidArgument,
      reason: ErrorReason.VALIDATION_FAILED,
      message: "bad",
      fieldViolations: [{ field: "url", description: "must be a URL" }],
    });
    const [bad] = err.findDetails(BadRequestSchema);
    expect(bad.fieldViolations).toHaveLength(1);
    expect(bad.fieldViolations[0]).toMatchObject({
      field: "url",
      description: "must be a URL",
    });
    expect(err.findDetails(RetryInfoSchema)).toHaveLength(0);
  });

  test("omits optional details when not asked for", () => {
    const err = rpcError({
      code: Code.NotFound,
      reason: ErrorReason.NOT_FOUND,
      message: "x",
    });
    expect(err.details).toHaveLength(1);
  });
});

describe("withErrorInfo", () => {
  test("adds a generic reason, docs and requestId to a bare ConnectError", () => {
    const bare = new ConnectError("nope", Code.NotFound);
    const err = withErrorInfo(bare, "req-1");
    expect(err).toBe(bare);
    expect(info(err)).toMatchObject({
      reason: "NOT_FOUND",
      domain: ERROR_DOMAIN,
      metadata: { requestId: "req-1", docs: errorDocsUrl("NOT_FOUND") },
    });
  });

  test("keeps a specific reason and merges metadata", () => {
    const err = withErrorInfo(
      rpcError({
        code: Code.NotFound,
        reason: ErrorReason.MONITOR_NOT_FOUND,
        message: "x",
        metadata: { monitorId: "7" },
      }),
      "req-2",
    );
    expect(err.findDetails(ErrorInfoSchema)).toHaveLength(1);
    expect(info(err)).toMatchObject({
      reason: "MONITOR_NOT_FOUND",
      metadata: {
        monitorId: "7",
        requestId: "req-2",
        docs: errorDocsUrl("NOT_FOUND"),
      },
    });
  });

  test("a v1 reason picks its own docs section over the Connect code", () => {
    const err = withErrorInfo(
      rpcError({
        code: Code.ResourceExhausted,
        reason: ErrorReason.PAYMENT_REQUIRED,
        message: "x",
      }),
    );
    expect(info(err).metadata.docs).toBe(errorDocsUrl("PAYMENT_REQUIRED"));
  });

  test("an explicit docs entry wins over the derived one", () => {
    const err = withErrorInfo(
      rpcError({
        code: Code.NotFound,
        reason: ErrorReason.NOT_FOUND,
        message: "x",
        metadata: { docs: "https://example.com/custom" },
      }),
      "req-3",
    );
    expect(info(err).metadata.docs).toBe("https://example.com/custom");
  });

  test("leaves requestId out when there is none", () => {
    const err = withErrorInfo(new ConnectError("x", Code.Internal));
    expect(info(err).metadata).not.toHaveProperty("requestId");
    expect(info(err).metadata.docs).toBe(errorDocsUrl("INTERNAL_SERVER_ERROR"));
  });

  test("is idempotent", () => {
    const err = withErrorInfo(withErrorInfo(new ConnectError("x"), "a"), "b");
    expect(err.findDetails(ErrorInfoSchema)).toHaveLength(1);
    expect(info(err).metadata.requestId).toBe("a");
  });
});

describe("code mapping", () => {
  test("every v1 code has a Connect code and a docs section", () => {
    for (const code of ErrorCodes) {
      const connect = ERROR_CODE_TO_CONNECT[code];
      expect(typeof connect).toBe("number");
      expect(ErrorCodes).toContain(connectCodeToErrorCode(connect));
    }
  });

  test("round-trips the codes that have a one-to-one twin", () => {
    for (const code of [
      "BAD_REQUEST",
      "UNAUTHORIZED",
      "FORBIDDEN",
      "NOT_FOUND",
      "METHOD_NOT_ALLOWED",
      "CONFLICT",
      "TOO_MANY_REQUESTS",
      "INTERNAL_SERVER_ERROR",
      "SERVICE_UNAVAILABLE",
    ] as const) {
      expect(connectCodeToErrorCode(ERROR_CODE_TO_CONNECT[code])).toBe(code);
    }
  });

  test("unknown Connect codes fall back to the internal section", () => {
    expect(connectCodeToErrorCode(Code.DataLoss)).toBe("INTERNAL_SERVER_ERROR");
    expect(connectCodeToErrorCode(Code.Canceled)).toBe("INTERNAL_SERVER_ERROR");
    expect(connectCodeToErrorCode(Code.FailedPrecondition)).toBe(
      "UNPROCESSABLE_ENTITY",
    );
  });
});

describe("connectErrorToJson", () => {
  test("produces the Connect wire shape with typed, base64 details and debug", () => {
    const err = withErrorInfo(
      rpcError({
        code: Code.Unavailable,
        reason: ErrorReason.SERVICE_UNAVAILABLE,
        message: "Server is busy, retry shortly",
        retryAfterSeconds: 5,
      }),
      "req-9",
    );
    const json = connectErrorToJson(err) as {
      code: string;
      message: string;
      details: { type: string; value: string; debug?: unknown }[];
    };
    expect(json.code).toBe("unavailable");
    expect(json.message).toBe("Server is busy, retry shortly");
    expect(json.details.map((d) => d.type)).toEqual([
      "google.rpc.ErrorInfo",
      "google.rpc.RetryInfo",
    ]);
    expect(json.details[0].debug).toEqual({
      reason: "SERVICE_UNAVAILABLE",
      domain: ERROR_DOMAIN,
      metadata: {
        requestId: "req-9",
        docs: errorDocsUrl("SERVICE_UNAVAILABLE"),
      },
    });
    expect(json.details[1].debug).toEqual({ retryDelay: "5s" });
    // value is unpadded base64 (Connect "std_raw")
    expect(json.details[0].value).toMatch(/^[A-Za-z0-9+/]+$/);
  });

  test("a Connect client parses it back with the same reason and metadata", () => {
    const err = withErrorInfo(
      rpcError({
        code: Code.ResourceExhausted,
        reason: ErrorReason.TOO_MANY_REQUESTS,
        message: "slow down",
        retryAfterSeconds: 7,
      }),
      "req-10",
    );
    const parsed = errorFromJson(
      connectErrorToJson(err) as JsonValue,
      undefined,
      new ConnectError("fallback", Code.Unknown),
    );
    expect(parsed.code).toBe(Code.ResourceExhausted);
    expect(parsed.rawMessage).toBe("slow down");
    expect(info(parsed)).toMatchObject({
      reason: "TOO_MANY_REQUESTS",
      metadata: { requestId: "req-10" },
    });
    expect(parsed.findDetails(RetryInfoSchema)[0].retryDelay?.seconds).toBe(7n);
  });
});

// Mirrors `slugify` in apps/web/src/content/mdx-components/heading.tsx, which
// produces the anchors the `docs` links point at.
function headingSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/&/g, "-and-")
    .replace(/[^\w-]+/g, "")
    .replace(/--+/g, "-");
}

describe("docs page stays in sync", () => {
  const page = Deno.readTextFileSync(
    new URL(
      "../../../../web/src/content/pages/docs/reference/api-errors.mdx",
      import.meta.url,
    ),
  );
  const headings = page
    .split("\n")
    .filter((l) => /^#{2,3} /.test(l))
    .map((l) => headingSlug(l.replace(/^#+\s*/, "").replace(/`/g, "")));

  test("every docs link resolves to a heading on the errors page", () => {
    for (const code of ErrorCodes) {
      const anchor = errorDocsUrl(code).split("#")[1];
      expect(headings).toContain(anchor);
    }
  });

  test("every reason is documented", () => {
    for (const reason of Object.values(ErrorReason)) {
      expect(page).toContain(`| \`${reason}\` |`);
    }
  });

  test("the docs page lists no reason the server cannot produce", () => {
    const documented = [...page.matchAll(/^\| `([A-Z_]+)` \|/gm)].map(
      (m) => m[1],
    );
    for (const reason of documented) {
      expect(Object.values(ErrorReason)).toContain(reason);
    }
  });
});
