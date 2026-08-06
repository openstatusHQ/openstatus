import { Code, ConnectError, type Interceptor } from "@connectrpc/connect";
import { describe, expect, test } from "@openstatus/test-utils";

import { RPC_CONTEXT_KEY } from "../auth";
import { errorInterceptor } from "../error";

type NextFn = Parameters<Interceptor>[0];
type RpcRequest = Parameters<NextFn>[0];

function mockNextReject(error: unknown): NextFn {
  return (() => Promise.reject(error)) as unknown as NextFn;
}

function createMockRequest(opts?: { requestId?: string }): RpcRequest {
  const contextValues = new Map<unknown, unknown>();
  if (opts?.requestId) {
    contextValues.set(RPC_CONTEXT_KEY, { requestId: opts.requestId });
  }
  return {
    service: { typeName: "openstatus.status_page.v1.StatusPageService" },
    method: { name: "AddMonitorComponent" },
    message: {},
    header: new Headers(),
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

// A drizzle `DrizzleQueryError.message` is the rendered SQL plus the bound
// params — the exact shape that leaked to a Terraform user via the RPC API.
const DRIZZLE_ERROR = new Error(
  'Failed query: insert into "page_component" ("id", "workspace_id", "page_id") ' +
    'values (null, ?, ?) returning "id"\nparams: 13049,5354,monitor',
);

describe("errorInterceptor", () => {
  test("redacts an unclassified error to an opaque Internal", async () => {
    const err = (await captureReject(() =>
      errorInterceptor()(mockNextReject(DRIZZLE_ERROR))(
        createMockRequest({ requestId: "req-1" }),
      ),
    )) as ConnectError;

    expect(err).toBeInstanceOf(ConnectError);
    expect(err.code).toBe(Code.Internal);
    expect(err.rawMessage).not.toContain("page_component");
    expect(err.rawMessage).not.toContain("params:");
    expect(err.rawMessage).not.toContain("insert into");
  });

  test("carries the request id so logs and client share a correlation id", async () => {
    const err = (await captureReject(() =>
      errorInterceptor()(mockNextReject(DRIZZLE_ERROR))(
        createMockRequest({ requestId: "req-correlate-me" }),
      ),
    )) as ConnectError;

    expect(err.rawMessage).toContain("req-correlate-me");
  });

  test("falls back to a bare message when there is no RPC context", async () => {
    const err = (await captureReject(() =>
      errorInterceptor()(mockNextReject(DRIZZLE_ERROR))(createMockRequest()),
    )) as ConnectError;

    expect(err.rawMessage).toBe("Internal server error");
  });

  test("passes an existing ConnectError through unchanged", async () => {
    const original = new ConnectError("Monitor not found", Code.NotFound);
    const err = await captureReject(() =>
      errorInterceptor()(mockNextReject(original))(
        createMockRequest({ requestId: "req-2" }),
      ),
    );

    expect(err).toBe(original);
  });
});
