import { getServiceContextFromRequest } from "@/lib/edge-context";
import { ServiceError, type ServiceErrorCode } from "@openstatus/services";
import {
  type CheckResult,
  streamMonitorPreview,
} from "@openstatus/services/monitor";
import { iteratorToStream } from "@openstatus/utils";
import { z } from "zod";

export const runtime = "edge";

const SERVICE_ERROR_STATUS: Record<ServiceErrorCode, number> = {
  NOT_FOUND: 404,
  FORBIDDEN: 403,
  UNAUTHORIZED: 401,
  CONFLICT: 409,
  VALIDATION: 400,
  LIMIT_EXCEEDED: 429,
  PRECONDITION_FAILED: 412,
  INTERNAL: 500,
};

const requestSchema = z.object({
  monitorId: z.number(),
});

const encoder = new TextEncoder();

export async function POST(req: Request) {
  const ctx = await getServiceContextFromRequest(req);
  if (!ctx) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: { monitorId: number };
  try {
    const json = await req.json();
    const parsed = requestSchema.safeParse(json);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "Invalid request" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    body = parsed.data;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Resolve the monitor up-front so workspace-mismatch returns 404 instead of
  // a 200 stream that fails on first iteration. We "prime" the generator by
  // calling .next() once — if the workspace-scope check throws, we catch it
  // synchronously here. Subsequent values come from the same generator.
  const generator = streamMonitorPreview({
    ctx,
    input: { monitorId: body.monitorId },
  });

  let primed: IteratorResult<CheckResult>;
  try {
    primed = await generator.next();
  } catch (err: unknown) {
    if (err instanceof ServiceError) {
      const status = SERVICE_ERROR_STATUS[err.code] ?? 500;
      // Don't leak `INTERNAL` messages — they may include env-var names or
      // stack details. Other codes are already user-facing strings.
      const message =
        err.code === "INTERNAL" ? "Internal server error" : err.message;
      return new Response(JSON.stringify({ error: message }), {
        status,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const wrapped = (async function* () {
    if (!primed.done && primed.value) {
      yield encoder.encode(`${JSON.stringify(primed.value)}\n`);
    }
    try {
      for await (const result of generator) {
        yield encoder.encode(`${JSON.stringify(result)}\n`);
      }
    } catch (err) {
      // The fan-out is `Promise.race`-based and individual region failures
      // are returned as error-shaped CheckResults, so we don't expect to
      // land here. Log so an unexpected failure isn't silent — the stream
      // still closes cleanly so the client doesn't hang.
      console.warn(
        "[onboarding/checks] unexpected generator error post-prime",
        err,
      );
    }
  })();

  const stream = iteratorToStream(wrapped);
  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-store",
    },
  });
}
