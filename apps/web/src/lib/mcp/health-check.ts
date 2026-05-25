// Edge-safe: no node:* imports allowed.
// MCP spec: https://modelcontextprotocol.io/specification/2025-06-18

import { redis } from "@openstatus/upstash";
import { assertSafeUrlSync } from "@openstatus/utils";
import { z } from "zod";
import {
  PROTOCOL_VERSION,
  REQ_ID_INIT,
  REQ_ID_PING,
  REQ_ID_TOOLS,
  STEP_REQUEST_BODIES,
} from "./protocol";

const STEP_TIMEOUT_MS = 8_000;
const METADATA_FETCH_TIMEOUT_MS = 3_000;
// How much body we keep around (in memory + persisted-with-cap downstream).
const RAW_BODY_CAP = 32_768;
// How far the SSE reader scans the stream looking for the matching id frame.
// Independent of RAW_BODY_CAP — large tools/list responses can exceed the kept
// body but the matching frame still needs to be found.
const SSE_SCAN_LIMIT = 262_144;

const stepErrorCodeSchema = z.enum([
  "TIMEOUT",
  "NETWORK",
  "HTTP_STATUS",
  "PARSE",
  "ID_MISMATCH",
  "JSON_RPC_ERROR",
  "UNAUTHORIZED",
]);

const stepResultSchema = z.object({
  ok: z.boolean(),
  latencyMs: z.number(),
  rawBody: z.string().optional(),
  error: z
    .object({
      code: stepErrorCodeSchema,
      message: z.string(),
    })
    .optional(),
});

const authChallengeSchema = z.object({
  authorizationServer: z.string().optional(),
  scopes: z.array(z.string()).optional(),
  mechanism: z.enum(["oauth", "bearer-static", "unknown"]),
});

const toolAnnotationsSchema = z.object({
  readOnlyHint: z.boolean().optional(),
  destructiveHint: z.boolean().optional(),
  idempotentHint: z.boolean().optional(),
  openWorldHint: z.boolean().optional(),
});

const toolInfoSchema = z.object({
  name: z.string(),
  title: z.string().optional(),
  description: z.string().optional(),
  annotations: toolAnnotationsSchema.optional(),
});

export const healthCheckReportSchema = z.object({
  url: z.string(),
  timestamp: z.number(),
  verdict: z.enum(["healthy", "partial", "auth-required", "unreachable"]),
  initialize: stepResultSchema.extend({
    protocolVersion: z.string().optional(),
    serverInfo: z.object({ name: z.string(), version: z.string() }).optional(),
    capabilities: z.record(z.string(), z.unknown()).optional(),
    hasSessionId: z.boolean().optional(),
  }),
  ping: stepResultSchema,
  toolsList: stepResultSchema.extend({
    toolCount: z.number().optional(),
    tools: z.array(toolInfoSchema).optional(),
    truncated: z.boolean().optional(),
  }),
  authChallenge: authChallengeSchema.optional(),
});

export type StepErrorCode = z.infer<typeof stepErrorCodeSchema>;
export type StepResult = z.infer<typeof stepResultSchema>;
export type AuthChallenge = z.infer<typeof authChallengeSchema>;
export type ToolInfo = z.infer<typeof toolInfoSchema>;
export type HealthCheckReport = z.infer<typeof healthCheckReportSchema>;

export type HealthCheckInput = {
  url: string;
  headers?: Array<{ key: string; value: string }>;
};

type JsonRpcResponse = {
  jsonrpc?: string;
  id?: string | number | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
};

type RpcOutcome = {
  // mirrors res.ok (HTTP 2xx); parse success lives in json/parseError so a 200
  // with an unparseable body classifies as PARSE, not HTTP_STATUS.
  ok: boolean;
  status: number;
  headers: Headers;
  rawBody: string;
  json?: JsonRpcResponse;
  parseError?: string;
};

type HeaderOpts = {
  sessionId?: string;
  protocolVersion?: string;
  // notification mode: server must not open an SSE stream (we'd stall).
  notification?: boolean;
};

// User headers must not clobber the handshake-critical headers set below;
// overriding Content-Type/Accept silently breaks the MCP transport negotiation.
const RESERVED_HEADERS = new Set([
  "content-type",
  "accept",
  "mcp-session-id",
  "mcp-protocol-version",
]);

function buildHeaders(
  extra?: HealthCheckInput["headers"],
  opts: HeaderOpts = {},
) {
  const headers = new Headers({
    "Content-Type": "application/json",
    Accept: opts.notification
      ? "application/json"
      : "application/json, text/event-stream",
  });
  if (opts.sessionId) headers.set("Mcp-Session-Id", opts.sessionId);
  // MCP 2025-06-18 §lifecycle: clients SHOULD send this on every request
  // after initialize so version-pinning gateways route correctly.
  if (opts.protocolVersion) {
    headers.set("MCP-Protocol-Version", opts.protocolVersion);
  }
  for (const { key, value } of extra ?? []) {
    if (!key || RESERVED_HEADERS.has(key.toLowerCase())) continue;
    headers.set(key, value);
  }
  return headers;
}

function capRaw(body: string) {
  if (body.length <= RAW_BODY_CAP) return body;
  return `${body.slice(0, RAW_BODY_CAP)}…[truncated]`;
}

/**
 * Reads an SSE stream until it finds the first `event: message` frame whose
 * JSON payload's `id` matches `expectedId`. Aborts the reader after parsing.
 */
async function readSseUntilId(
  body: ReadableStream<Uint8Array>,
  expectedId: string,
): Promise<{ json?: JsonRpcResponse; rawBody: string; parseError?: string }> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let raw = "";
  let currentEvent = "message";
  const dataLines: string[] = [];

  const flush = (): JsonRpcResponse | undefined => {
    if (dataLines.length === 0) return undefined;
    const data = dataLines.join("\n");
    dataLines.length = 0;
    try {
      const parsed = JSON.parse(data) as JsonRpcResponse;
      if (currentEvent === "message" && parsed.id === expectedId) return parsed;
    } catch {
      /* ignore non-JSON data frames */
    }
    return undefined;
  };

  // Bytes scanned, not bytes kept: `raw` is capped via capRaw() only when we
  // return it. Letting it grow up to SSE_SCAN_LIMIT means a 100 KB tools/list
  // payload still finds its matching frame even if we only persist 32 KB.
  let scanned = 0;
  try {
    while (scanned < SSE_SCAN_LIMIT) {
      const { value, done } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      scanned += chunk.length;
      raw += chunk;
      buf += chunk;

      let nl = buf.indexOf("\n");
      while (nl !== -1) {
        const line = buf.slice(0, nl).replace(/\r$/, "");
        buf = buf.slice(nl + 1);

        if (line === "") {
          const matched = flush();
          if (matched) {
            await reader.cancel().catch(() => {});
            return { json: matched, rawBody: capRaw(raw) };
          }
          currentEvent = "message";
        } else if (line.startsWith(":")) {
          // comment
        } else if (line.startsWith("event:")) {
          currentEvent = line.slice(6).trim();
        } else if (line.startsWith("data:")) {
          dataLines.push(line.slice(5).replace(/^\s/, ""));
        }
        nl = buf.indexOf("\n");
      }
    }
    const tail = flush();
    if (tail) return { json: tail, rawBody: capRaw(raw) };
    return {
      rawBody: capRaw(raw),
      parseError: "no matching SSE event in stream",
    };
  } catch (err) {
    return {
      rawBody: capRaw(raw),
      parseError: err instanceof Error ? err.message : String(err),
    };
  } finally {
    await reader.cancel().catch(() => {});
  }
}

const MAX_REDIRECTS = 3;

// redirect:"follow" would let a public host 3xx us into a private/internal
// address, past the pre-flight assertSafeUrlSync. Follow manually instead and
// re-validate every hop. Server runtimes surface the 3xx + Location under
// redirect:"manual"; an opaqueredirect (no readable Location) is rejected.
export async function safeFetch(
  url: string,
  init: RequestInit,
  signal: AbortSignal,
): Promise<Response> {
  let target = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const res = await fetch(target, { ...init, signal, redirect: "manual" });
    if (res.type === "opaqueredirect") {
      throw new Error("refusing to follow opaque redirect");
    }
    if (res.status < 300 || res.status >= 400) return res;
    const location = res.headers.get("location");
    if (!location) return res;
    target = new URL(location, target).toString();
    assertSafeUrlSync(target);
  }
  throw new Error("too many redirects");
}

async function sendRpc({
  url,
  headers,
  body,
  expectedId,
  signal,
}: {
  url: string;
  headers: Headers;
  body: unknown;
  expectedId?: string;
  signal: AbortSignal;
}): Promise<RpcOutcome> {
  const res = await safeFetch(
    url,
    { method: "POST", headers, body: JSON.stringify(body) },
    signal,
  );

  const contentType = res.headers.get("content-type")?.toLowerCase() ?? "";

  if (expectedId === undefined) {
    // fire-and-forget notification: drain a bit to be polite, but don't parse
    let raw = "";
    try {
      raw = await res.text();
    } catch {
      /* ignore */
    }
    return {
      ok: res.ok,
      status: res.status,
      headers: res.headers,
      rawBody: capRaw(raw),
    };
  }

  if (contentType.includes("text/event-stream") && res.body) {
    const { json, rawBody, parseError } = await readSseUntilId(
      res.body,
      expectedId,
    );
    return {
      ok: res.ok,
      status: res.status,
      headers: res.headers,
      rawBody,
      json,
      parseError,
    };
  }

  let rawText = "";
  try {
    rawText = await res.text();
  } catch (err) {
    return {
      ok: res.ok,
      status: res.status,
      headers: res.headers,
      rawBody: "",
      parseError: err instanceof Error ? err.message : String(err),
    };
  }

  if (contentType.includes("application/json")) {
    try {
      return {
        ok: res.ok,
        status: res.status,
        headers: res.headers,
        rawBody: capRaw(rawText),
        json: JSON.parse(rawText) as JsonRpcResponse,
      };
    } catch (err) {
      return {
        ok: res.ok,
        status: res.status,
        headers: res.headers,
        rawBody: capRaw(rawText),
        parseError: err instanceof Error ? err.message : String(err),
      };
    }
  }

  return {
    ok: res.ok,
    status: res.status,
    headers: res.headers,
    rawBody: capRaw(rawText),
    parseError: contentType
      ? `unexpected content-type: ${contentType}`
      : "missing content-type",
  };
}

function withTimeout(
  ms: number,
  parent?: AbortSignal,
): { signal: AbortSignal; cancel: () => void } {
  const ctrl = new AbortController();
  const timer = setTimeout(
    () => ctrl.abort(new DOMException("timeout", "TimeoutError")),
    ms,
  );
  const onAbort = () => ctrl.abort(parent?.reason);
  if (parent?.aborted) onAbort();
  else parent?.addEventListener("abort", onAbort, { once: true });
  return {
    signal: ctrl.signal,
    cancel: () => {
      clearTimeout(timer);
      parent?.removeEventListener("abort", onAbort);
    },
  };
}

function classifyFetchError(err: unknown): {
  code: StepErrorCode;
  message: string;
} {
  if (err instanceof DOMException && err.name === "TimeoutError") {
    return { code: "TIMEOUT", message: "request timed out" };
  }
  if (err instanceof DOMException && err.name === "AbortError") {
    return { code: "TIMEOUT", message: "request aborted" };
  }
  const message = err instanceof Error ? err.message : String(err);
  return { code: "NETWORK", message };
}

/**
 * RFC 6750 / RFC 7235 WWW-Authenticate parser, scoped to the `Bearer` scheme.
 * Returns parsed params (e.g. `realm`, `resource_metadata`, `scope`) or null
 * when the header isn't a Bearer challenge.
 *
 * Handles quoted values containing commas/equals, which substring matching breaks on.
 */
export function parseBearerChallenge(
  header: string | null,
): Record<string, string> | null {
  if (!header) return null;
  const trimmed = header.trim();
  // Header may list multiple schemes (e.g., "Bearer ..., DPoP ..."). Pick Bearer.
  const match = trimmed.match(/^Bearer(?:\s+(.*))?$/i);
  if (!match) {
    // Try to locate "Bearer " segment in a multi-scheme header.
    const idx = trimmed.toLowerCase().indexOf("bearer");
    if (idx === -1) return null;
    return parseBearerParams(trimmed.slice(idx + "bearer".length));
  }
  return parseBearerParams(match[1] ?? "");
}

function parseBearerParams(input: string): Record<string, string> {
  const params: Record<string, string> = {};
  let i = 0;
  const len = input.length;
  while (i < len) {
    while (i < len && /\s|,/.test(input[i])) i++;
    if (i >= len) break;
    const keyStart = i;
    while (i < len && input[i] !== "=" && !/\s|,/.test(input[i])) i++;
    const key = input.slice(keyStart, i).toLowerCase();
    if (!key) {
      i++;
      continue;
    }
    while (i < len && /\s/.test(input[i])) i++;
    if (input[i] !== "=") {
      // bare token (e.g. another scheme name); stop parsing this scheme.
      break;
    }
    i++;
    while (i < len && /\s/.test(input[i])) i++;
    let value = "";
    if (input[i] === '"') {
      i++;
      while (i < len && input[i] !== '"') {
        if (input[i] === "\\" && i + 1 < len) {
          value += input[i + 1];
          i += 2;
        } else {
          value += input[i];
          i++;
        }
      }
      if (input[i] === '"') i++;
    } else {
      const valStart = i;
      while (i < len && input[i] !== "," && !/\s/.test(input[i])) i++;
      value = input.slice(valStart, i);
    }
    params[key] = value;
  }
  return params;
}

async function resolveAuthChallenge(
  wwwAuthenticate: string | null,
  parentSignal: AbortSignal,
): Promise<AuthChallenge | undefined> {
  const params = parseBearerChallenge(wwwAuthenticate);
  if (!params) return { mechanism: "unknown" };
  const resourceMetadata = params.resource_metadata;
  if (!resourceMetadata) {
    return { mechanism: "bearer-static" };
  }

  const challenge: AuthChallenge = { mechanism: "oauth" };

  // The server supplied this URL — guard against ricochet into private IPs.
  try {
    assertSafeUrlSync(resourceMetadata);
  } catch {
    return challenge;
  }

  const { signal, cancel } = withTimeout(
    METADATA_FETCH_TIMEOUT_MS,
    parentSignal,
  );
  try {
    const res = await safeFetch(
      resourceMetadata,
      { method: "GET", headers: { Accept: "application/json" } },
      signal,
    );
    if (!res.ok) return challenge;
    const ct = res.headers.get("content-type")?.toLowerCase() ?? "";
    if (!ct.includes("json")) return challenge;
    const data = (await res.json()) as {
      authorization_servers?: unknown;
      scopes_supported?: unknown;
    };
    if (Array.isArray(data.authorization_servers)) {
      const first = data.authorization_servers.find(
        (v): v is string => typeof v === "string",
      );
      if (first) challenge.authorizationServer = first;
    }
    if (Array.isArray(data.scopes_supported)) {
      challenge.scopes = data.scopes_supported.filter(
        (v): v is string => typeof v === "string",
      );
    }
  } catch {
    /* swallow; header alone proved OAuth posture */
  } finally {
    cancel();
  }
  return challenge;
}

export function stepFromOutcome({
  outcome,
  startedAt,
  expectedId,
}: {
  outcome: RpcOutcome;
  startedAt: number;
  expectedId: string;
}): StepResult {
  const latencyMs = Date.now() - startedAt;
  const rawBody = outcome.rawBody ? capRaw(outcome.rawBody) : undefined;

  if (outcome.status === 401) {
    return {
      ok: false,
      latencyMs,
      rawBody,
      error: { code: "UNAUTHORIZED", message: "server returned 401" },
    };
  }
  if (!outcome.ok) {
    return {
      ok: false,
      latencyMs,
      rawBody,
      error: {
        code: "HTTP_STATUS",
        message:
          outcome.status === 406
            ? "HTTP 406 — server rejected `application/json, text/event-stream` Accept; it likely requires one only"
            : `HTTP ${outcome.status}`,
      },
    };
  }
  if (outcome.parseError || !outcome.json) {
    return {
      ok: false,
      latencyMs,
      rawBody,
      error: {
        code: "PARSE",
        message: outcome.parseError ?? "missing JSON-RPC body",
      },
    };
  }
  if (outcome.json.error) {
    return {
      ok: false,
      latencyMs,
      rawBody,
      error: {
        code: "JSON_RPC_ERROR",
        message: `${outcome.json.error.code}: ${outcome.json.error.message}`,
      },
    };
  }
  if (outcome.json.id !== expectedId) {
    return {
      ok: false,
      latencyMs,
      rawBody,
      error: {
        code: "ID_MISMATCH",
        message: `expected id ${expectedId}, got ${JSON.stringify(outcome.json.id)}`,
      },
    };
  }
  return { ok: true, latencyMs, rawBody };
}

function emptyStep(): StepResult {
  return { ok: false, latencyMs: 0 };
}

/**
 * Strips userinfo, query, and fragment from `url`. Returns `origin + path`.
 * Falls back to the input if parsing fails (caller already validated it).
 */
export function normalizeUrlForStorage(url: string) {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}${u.pathname}`;
  } catch {
    return url;
  }
}

export async function runMcpHealthCheck(
  input: HealthCheckInput,
): Promise<HealthCheckReport> {
  const { url } = input;
  const report: HealthCheckReport = {
    url: normalizeUrlForStorage(url),
    timestamp: Date.now(),
    verdict: "unreachable",
    initialize: emptyStep(),
    ping: emptyStep(),
    toolsList: emptyStep(),
  };

  // --- Step 1: initialize ---
  const initStarted = Date.now();
  let initOutcome: RpcOutcome | undefined;
  let initWwwAuthenticate: string | null = null;
  const init = withTimeout(STEP_TIMEOUT_MS);
  try {
    initOutcome = await sendRpc({
      url,
      headers: buildHeaders(input.headers),
      body: STEP_REQUEST_BODIES.initialize,
      expectedId: REQ_ID_INIT,
      signal: init.signal,
    });
  } catch (err) {
    const { code, message } = classifyFetchError(err);
    report.initialize = {
      ok: false,
      latencyMs: Date.now() - initStarted,
      error: { code, message },
    };
    report.verdict = "unreachable";
    init.cancel();
    return report;
  }
  init.cancel();
  initWwwAuthenticate = initOutcome.headers.get("www-authenticate");

  const initStep = stepFromOutcome({
    outcome: initOutcome,
    startedAt: initStarted,
    expectedId: REQ_ID_INIT,
  });
  report.initialize = { ...report.initialize, ...initStep };

  if (initOutcome.json?.result && typeof initOutcome.json.result === "object") {
    const result = initOutcome.json.result as {
      protocolVersion?: unknown;
      serverInfo?: { name?: unknown; version?: unknown };
      capabilities?: unknown;
    };
    if (typeof result.protocolVersion === "string") {
      report.initialize.protocolVersion = result.protocolVersion;
    }
    if (
      result.serverInfo &&
      typeof result.serverInfo.name === "string" &&
      typeof result.serverInfo.version === "string"
    ) {
      report.initialize.serverInfo = {
        name: result.serverInfo.name,
        version: result.serverInfo.version,
      };
    }
    if (result.capabilities && typeof result.capabilities === "object") {
      report.initialize.capabilities = result.capabilities as Record<
        string,
        unknown
      >;
    }
  }

  const sessionId = initOutcome.headers.get("mcp-session-id") ?? undefined;
  report.initialize.hasSessionId = Boolean(sessionId);
  const negotiated = report.initialize.protocolVersion ?? PROTOCOL_VERSION;

  if (initOutcome.status === 401) {
    report.authChallenge = await resolveAuthChallenge(
      initWwwAuthenticate,
      // resolve metadata with a fresh signal — the step's controller is done
      new AbortController().signal,
    );
    report.verdict = "auth-required";
    return report;
  }

  if (!initStep.ok) {
    report.verdict = "unreachable";
    return report;
  }

  // --- Step 2: notifications/initialized (fire-and-forget) ---
  const notifyCtrl = withTimeout(STEP_TIMEOUT_MS);
  try {
    await sendRpc({
      url,
      headers: buildHeaders(input.headers, {
        sessionId,
        protocolVersion: negotiated,
        notification: true,
      }),
      body: {
        jsonrpc: "2.0",
        method: "notifications/initialized",
      },
      signal: notifyCtrl.signal,
    });
  } catch {
    /* notifications are best-effort; ignore failures */
  } finally {
    notifyCtrl.cancel();
  }

  // --- Step 3: ping + tools/list in parallel ---
  const pingStarted = Date.now();
  const toolsStarted = Date.now();
  const pingCtrl = withTimeout(STEP_TIMEOUT_MS);
  const toolsCtrl = withTimeout(STEP_TIMEOUT_MS);

  type SettledRpc = {
    outcome?: RpcOutcome;
    error?: { code: StepErrorCode; message: string };
  };

  const followUpHeaders = () =>
    buildHeaders(input.headers, {
      sessionId,
      protocolVersion: negotiated,
    });

  const pingPromise: Promise<SettledRpc> = sendRpc({
    url,
    headers: followUpHeaders(),
    body: STEP_REQUEST_BODIES.ping,
    expectedId: REQ_ID_PING,
    signal: pingCtrl.signal,
  })
    .then((outcome): SettledRpc => ({ outcome }))
    .catch((err): SettledRpc => ({ error: classifyFetchError(err) }))
    .finally(() => pingCtrl.cancel());

  const toolsPromise: Promise<SettledRpc> = sendRpc({
    url,
    headers: followUpHeaders(),
    body: STEP_REQUEST_BODIES.toolsList,
    expectedId: REQ_ID_TOOLS,
    signal: toolsCtrl.signal,
  })
    .then((outcome): SettledRpc => ({ outcome }))
    .catch((err): SettledRpc => ({ error: classifyFetchError(err) }))
    .finally(() => toolsCtrl.cancel());

  const [pingRes, toolsRes] = await Promise.all([pingPromise, toolsPromise]);

  let pingWwwAuth: string | null = null;
  if (pingRes.error) {
    report.ping = {
      ok: false,
      latencyMs: Date.now() - pingStarted,
      error: pingRes.error,
    };
  } else if (pingRes.outcome) {
    pingWwwAuth = pingRes.outcome.headers.get("www-authenticate");
    report.ping = stepFromOutcome({
      outcome: pingRes.outcome,
      startedAt: pingStarted,
      expectedId: REQ_ID_PING,
    });
  }

  let toolsWwwAuth: string | null = null;
  if (toolsRes.error) {
    report.toolsList = {
      ok: false,
      latencyMs: Date.now() - toolsStarted,
      error: toolsRes.error,
    };
  } else if (toolsRes.outcome) {
    toolsWwwAuth = toolsRes.outcome.headers.get("www-authenticate");
    const toolsStep = stepFromOutcome({
      outcome: toolsRes.outcome,
      startedAt: toolsStarted,
      expectedId: REQ_ID_TOOLS,
    });
    report.toolsList = { ...report.toolsList, ...toolsStep };
    const result = toolsRes.outcome.json?.result;
    if (result && typeof result === "object" && "tools" in result) {
      const raw = (result as { tools?: unknown }).tools;
      if (Array.isArray(raw)) {
        const TOOLS_CAP = 50;
        const parsed = raw
          .map((t): ToolInfo | null => {
            if (!t || typeof t !== "object") return null;
            const obj = t as {
              name?: unknown;
              title?: unknown;
              description?: unknown;
              annotations?: {
                title?: unknown;
                readOnlyHint?: unknown;
                destructiveHint?: unknown;
                idempotentHint?: unknown;
                openWorldHint?: unknown;
              };
            };
            if (typeof obj.name !== "string") return null;
            const info: ToolInfo = { name: obj.name };
            const title =
              typeof obj.title === "string"
                ? obj.title
                : typeof obj.annotations?.title === "string"
                  ? obj.annotations.title
                  : undefined;
            if (title) info.title = title;
            if (typeof obj.description === "string") {
              info.description = obj.description;
            }
            const ann = obj.annotations;
            if (ann) {
              const hints: ToolInfo["annotations"] = {};
              if (typeof ann.readOnlyHint === "boolean")
                hints.readOnlyHint = ann.readOnlyHint;
              if (typeof ann.destructiveHint === "boolean")
                hints.destructiveHint = ann.destructiveHint;
              if (typeof ann.idempotentHint === "boolean")
                hints.idempotentHint = ann.idempotentHint;
              if (typeof ann.openWorldHint === "boolean")
                hints.openWorldHint = ann.openWorldHint;
              if (Object.keys(hints).length > 0) info.annotations = hints;
            }
            return info;
          })
          .filter((t): t is ToolInfo => t !== null);
        report.toolsList.toolCount = raw.length;
        report.toolsList.tools = parsed.slice(0, TOOLS_CAP);
        report.toolsList.truncated = raw.length > TOOLS_CAP;
      }
    }
  }

  // Verdict resolution
  const authStatus =
    pingRes.outcome?.status === 401 || toolsRes.outcome?.status === 401;
  if (authStatus) {
    report.authChallenge = await resolveAuthChallenge(
      pingWwwAuth ?? toolsWwwAuth,
      new AbortController().signal,
    );
    report.verdict = "auth-required";
    return report;
  }

  if (report.ping.ok && report.toolsList.ok) {
    report.verdict = "healthy";
  } else if (report.ping.ok) {
    report.verdict = "partial";
  } else {
    report.verdict = "unreachable";
  }

  return report;
}

/**
 * Persisted shape: same as `HealthCheckReport` but with stricter caps and the
 * URL re-normalized. Request headers are never persisted.
 */
export function toPersistedReport(
  report: HealthCheckReport,
): HealthCheckReport {
  const PERSIST_RAW_CAP = 16_384;
  const capStep = <T extends StepResult>(step: T): T => {
    if (!step.rawBody) return step;
    return step.rawBody.length > PERSIST_RAW_CAP
      ? {
          ...step,
          rawBody: `${step.rawBody.slice(0, PERSIST_RAW_CAP)}…[truncated]`,
        }
      : step;
  };
  return {
    ...report,
    url: normalizeUrlForStorage(report.url),
    initialize: capStep(report.initialize),
    ping: capStep(report.ping),
    toolsList: capStep(report.toolsList),
  };
}

export function reportRedisKey(id: string) {
  return `mcp-health:report:${id}`;
}

const REPORT_TTL_SECONDS = 60 * 60 * 24 * 7;

export async function storeHealthReport(
  id: string,
  report: HealthCheckReport,
): Promise<void> {
  // Validate before write so we never persist a shape `getHealthReportById`
  // would reject. Soft-fail (log + return) rather than throw so the caller's
  // `after()` callback can still run analytics.
  const result = healthCheckReportSchema.safeParse(report);
  if (!result.success) {
    console.warn("mcp-health: refused to store malformed report", result.error);
    return;
  }
  await redis.set(reportRedisKey(id), JSON.stringify(result.data), {
    ex: REPORT_TTL_SECONDS,
  });
}

export async function getHealthReportById(
  id: string,
): Promise<HealthCheckReport | null> {
  try {
    const raw = await redis.get<unknown>(reportRedisKey(id));
    if (raw == null) return null;
    const candidate = typeof raw === "string" ? JSON.parse(raw) : raw;
    const result = healthCheckReportSchema.safeParse(candidate);
    if (!result.success) {
      console.warn("mcp-health: discarded malformed report", id, result.error);
      return null;
    }
    return result.data;
  } catch (error) {
    console.error("getHealthReportById failed", error);
    return null;
  }
}
