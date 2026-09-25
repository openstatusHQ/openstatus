import { Code, ConnectError } from "@connectrpc/connect";
import { errorFromJson } from "@connectrpc/connect/protocol-connect";
import { errorDocsUrl } from "@openstatus/error";
import { ErrorInfoSchema } from "@openstatus/proto/google/rpc";
import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

import { app } from "../../../index";

/** Decodes a Connect JSON error body the way a Connect client would. */
async function parseError(res: Response): Promise<ConnectError> {
  return errorFromJson(
    await res.json(),
    res.headers,
    new ConnectError("unparseable", Code.Unknown),
  );
}

const info = (err: ConnectError) => err.findDetails(ErrorInfoSchema)[0];

function rpc(
  path: string,
  body: Record<string, unknown> = {},
  headers: Record<string, string> = {},
) {
  return app.request(`/rpc/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

describe("RPC error contract (wire)", () => {
  test("missing credentials: unauthenticated + ErrorInfo with requestId matching the response header", async () => {
    const res = await rpc("openstatus.monitor.v1.MonitorService/ListMonitors");
    expect(res.status).toBe(401);
    expect(res.headers.get("content-type")).toContain("application/json");

    const err = await parseError(res);
    expect(err.code).toBe(Code.Unauthenticated);
    const detail = info(err);
    expect(detail.reason).toBe("MISSING_CREDENTIALS");
    expect(detail.domain).toBe("openstatus.dev");
    expect(detail.metadata.docs).toBe(errorDocsUrl("UNAUTHORIZED"));
    expect(detail.metadata.requestId).toBeTruthy();
    expect(detail.metadata.requestId).toBe(res.headers.get("x-request-id"));
  });

  test("a client-supplied x-request-id is echoed in ErrorInfo and the header", async () => {
    const res = await rpc(
      "openstatus.monitor.v1.MonitorService/ListMonitors",
      {},
      { "x-request-id": "client-abc-123" },
    );
    const err = await parseError(res);
    expect(info(err).metadata.requestId).toBe("client-abc-123");
    expect(res.headers.get("x-request-id")).toBe("client-abc-123");
  });

  test("invalid api key: unauthenticated INVALID_API_KEY", async () => {
    const res = await rpc(
      "openstatus.monitor.v1.MonitorService/ListMonitors",
      {},
      { "x-openstatus-key": "definitely-not-a-key" },
    );
    expect(res.status).toBe(401);
    const err = await parseError(res);
    expect(info(err).reason).toBe("INVALID_API_KEY");
  });

  test("unknown procedure: 404 not_found with ErrorInfo", async () => {
    const res = await rpc("openstatus.monitor.v1.MonitorService/NoSuchMethod");
    expect(res.status).toBe(404);
    const err = await parseError(res);
    expect(err.code).toBe(Code.NotFound);
    expect(info(err)).toMatchObject({
      reason: "NOT_FOUND",
      metadata: { docs: errorDocsUrl("NOT_FOUND") },
    });
    expect(info(err).metadata.requestId).toBeTruthy();
  });

  test("wrong HTTP method: 405 unimplemented with ErrorInfo", async () => {
    const res = await app.request(
      "/rpc/openstatus.monitor.v1.MonitorService/ListMonitors",
      { method: "DELETE" },
    );
    expect(res.status).toBe(405);
    const err = await parseError(res);
    expect(err.code).toBe(Code.Unimplemented);
    expect(info(err).reason).toBe("METHOD_NOT_ALLOWED");
  });

  test("protovalidate failure: invalid_argument VALIDATION_FAILED with the Violations detail kept", async () => {
    const res = await rpc(
      "openstatus.monitor.v1.MonitorService/CreateHTTPMonitor",
      { monitor: { name: "", url: "not a url" } },
      { "x-openstatus-key": "1" },
    );
    expect(res.status).toBe(400);
    const err = await parseError(res);
    expect(err.code).toBe(Code.InvalidArgument);
    expect(info(err).reason).toBe("VALIDATION_FAILED");
    expect(info(err).metadata.docs).toBe(errorDocsUrl("BAD_REQUEST"));
    const types = err.details.map((d) =>
      "type" in d ? d.type : d.desc.typeName,
    );
    expect(types).toContain("google.rpc.ErrorInfo");
    expect(types).toContain("buf.validate.Violations");
  });

  test("missing resource: not_found with a specific reason and resource id in metadata", async () => {
    const res = await rpc(
      "openstatus.monitor.v1.MonitorService/GetMonitor",
      { id: "999999999" },
      { "x-openstatus-key": "1" },
    );
    expect(res.status).toBe(404);
    const err = await parseError(res);
    expect(err.code).toBe(Code.NotFound);
    expect(info(err)).toMatchObject({
      reason: "MONITOR_NOT_FOUND",
      metadata: { monitorId: "999999999", docs: errorDocsUrl("NOT_FOUND") },
    });
  });

  test("id required: invalid_argument VALIDATION_FAILED", async () => {
    const res = await rpc(
      "openstatus.monitor.v1.MonitorService/GetMonitor",
      { id: "" },
      { "x-openstatus-key": "1" },
    );
    expect(res.status).toBe(400);
    const err = await parseError(res);
    expect(info(err).reason).toBe("VALIDATION_FAILED");
  });

  test("every error body carries exactly one ErrorInfo", async () => {
    const responses = await Promise.all([
      rpc("openstatus.monitor.v1.MonitorService/ListMonitors"),
      rpc("openstatus.monitor.v1.MonitorService/NoSuchMethod"),
      rpc(
        "openstatus.monitor.v1.MonitorService/GetMonitor",
        { id: "999999999" },
        { "x-openstatus-key": "1" },
      ),
    ]);
    for (const res of responses) {
      const err = await parseError(res);
      expect(err.findDetails(ErrorInfoSchema)).toHaveLength(1);
    }
  });
});
