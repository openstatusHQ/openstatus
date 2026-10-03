import { Code, ConnectError, type Interceptor } from "@connectrpc/connect";
import { errorDocsUrl } from "@openstatus/error";
import { ErrorInfoSchema } from "@openstatus/proto/google/rpc";
import { describe, expect, test } from "@openstatus/test-utils";

import { OpenStatusApiError } from "@/libs/errors";
import { ErrorReason, rpcError } from "@/libs/errors/rpc";

import { RPC_CONTEXT_KEY } from "../auth";
import { errorInterceptor } from "../error";

type NextFn = Parameters<Interceptor>[0];
type RpcRequest = Parameters<NextFn>[0];

function mockNextReject(error: unknown): NextFn {
  return (() => Promise.reject(error)) as unknown as NextFn;
}

function createMockRequest(opts?: {
  requestId?: string;
  headers?: Record<string, string>;
}): RpcRequest {
  const contextValues = new Map<unknown, unknown>();
  if (opts?.requestId) {
    contextValues.set(RPC_CONTEXT_KEY, { requestId: opts.requestId });
  }
  return {
    service: { typeName: "openstatus.status_page.v1.StatusPageService" },
    method: { name: "AddMonitorComponent" },
    message: {},
    header: new Headers(opts?.headers),
    contextValues: { get: (key: unknown) => contextValues.get(key) },
  } as unknown as RpcRequest;
}

async function captureReject(fn: () => Promise<unknown>): Promise<unknown> {
  try {
    await fn();
  } catch (err) {
    return err;
  }
  throw new Error("expected fn to reject, but it resolved");
}

const run = (error: unknown, req: RpcRequest) =>
  captureReject(() =>
    errorInterceptor()(mockNextReject(error))(req),
  ) as Promise<ConnectError>;

const info = (err: ConnectError) => err.findDetails(ErrorInfoSchema)[0];

// A drizzle `DrizzleQueryError.message` is the rendered SQL plus the bound
// params — the exact shape that leaked to a Terraform user via the RPC API.
const DRIZZLE_ERROR = new Error(
  'Failed query: insert into "page_component" ("id", "workspace_id", "page_id") ' +
    'values (null, ?, ?) returning "id"\nparams: 13049,5354,monitor',
);

describe("errorInterceptor", () => {
  test("redacts an unclassified error to an opaque Internal", async () => {
    const err = await run(
      DRIZZLE_ERROR,
      createMockRequest({ requestId: "req-1" }),
    );

    expect(err).toBeInstanceOf(ConnectError);
    expect(err.code).toBe(Code.Internal);
    expect(err.rawMessage).not.toContain("page_component");
    expect(err.rawMessage).not.toContain("params:");
    expect(err.rawMessage).not.toContain("insert into");
    expect(info(err)).toMatchObject({
      reason: ErrorReason.INTERNAL_SERVER_ERROR,
      metadata: {
        requestId: "req-1",
        docs: errorDocsUrl("INTERNAL_SERVER_ERROR"),
      },
    });
  });

  test("carries the request id so logs and client share a correlation id", async () => {
    const err = await run(
      DRIZZLE_ERROR,
      createMockRequest({ requestId: "req-correlate-me" }),
    );

    expect(err.rawMessage).toContain("req-correlate-me");
    expect(info(err).metadata.requestId).toBe("req-correlate-me");
  });

  test("falls back to a bare message when there is no RPC context", async () => {
    const err = await run(DRIZZLE_ERROR, createMockRequest());

    expect(err.rawMessage).toBe("Internal server error");
    expect(info(err).metadata).not.toHaveProperty("requestId");
  });

  test("uses the x-request-id header before auth has built the context", async () => {
    const err = await run(
      new ConnectError("Invalid API Key", Code.Unauthenticated),
      createMockRequest({ headers: { "x-request-id": "hdr-1" } }),
    );

    expect(info(err).metadata.requestId).toBe("hdr-1");
  });

  test("passes an existing ConnectError through unchanged, adding ErrorInfo", async () => {
    const original = new ConnectError("Monitor not found", Code.NotFound);
    const err = await run(original, createMockRequest({ requestId: "req-2" }));

    expect(err).toBe(original);
    expect(err.code).toBe(Code.NotFound);
    expect(info(err)).toMatchObject({
      reason: ErrorReason.NOT_FOUND,
      metadata: { requestId: "req-2", docs: errorDocsUrl("NOT_FOUND") },
    });
  });

  test("keeps a handler's specific reason and metadata", async () => {
    const original = rpcError({
      code: Code.NotFound,
      reason: ErrorReason.MONITOR_NOT_FOUND,
      message: "Monitor not found",
      metadata: { monitorId: "5" },
    });
    const err = await run(original, createMockRequest({ requestId: "req-3" }));

    expect(err.findDetails(ErrorInfoSchema)).toHaveLength(1);
    expect(info(err)).toMatchObject({
      reason: ErrorReason.MONITOR_NOT_FOUND,
      metadata: { monitorId: "5", requestId: "req-3" },
    });
  });

  test("maps OpenStatusApiError codes to Connect codes with the v1 code as reason", async () => {
    const err = await run(
      new OpenStatusApiError({
        code: "NOT_FOUND",
        message: "Workspace not found",
      }),
      createMockRequest({ requestId: "req-4" }),
    );

    expect(err.code).toBe(Code.NotFound);
    expect(err.rawMessage).toBe("Workspace not found");
    expect(info(err)).toMatchObject({
      reason: "NOT_FOUND",
      metadata: { requestId: "req-4", docs: errorDocsUrl("NOT_FOUND") },
    });
  });

  test("maps every v1 code an OpenStatusApiError can carry", async () => {
    const cases = [
      ["BAD_REQUEST", Code.InvalidArgument],
      ["UNAUTHORIZED", Code.Unauthenticated],
      ["PAYMENT_REQUIRED", Code.ResourceExhausted],
      ["FORBIDDEN", Code.PermissionDenied],
      ["CONFLICT", Code.AlreadyExists],
      ["UNPROCESSABLE_ENTITY", Code.InvalidArgument],
      ["TOO_MANY_REQUESTS", Code.ResourceExhausted],
      ["INTERNAL_SERVER_ERROR", Code.Internal],
      ["SERVICE_UNAVAILABLE", Code.Unavailable],
    ] as const;
    for (const [code, connect] of cases) {
      const err = await run(
        new OpenStatusApiError({ code, message: code }),
        createMockRequest({ requestId: "req-5" }),
      );
      expect(err.code).toBe(connect);
      expect(info(err).reason).toBe(code);
      // Docs follow the v1 code, not the lossy Connect code.
      expect(info(err).metadata.docs).toBe(errorDocsUrl(code));
    }
  });
});
