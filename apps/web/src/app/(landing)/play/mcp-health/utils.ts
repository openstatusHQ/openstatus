import type { HealthCheckReport, StepResult } from "@/lib/mcp/health-check";

export { STEP_REQUEST_BODIES, type StepKey } from "@/lib/mcp/protocol";

export const VERDICT_LABEL: Record<HealthCheckReport["verdict"], string> = {
  healthy: "GOOD",
  partial: "WARN",
  "auth-required": "AUTH",
  unreachable: "DOWN",
};

export const VERDICT_DOT: Record<HealthCheckReport["verdict"], string> = {
  healthy: "bg-success",
  partial: "bg-warning",
  "auth-required": "bg-info",
  unreachable: "bg-destructive",
};

export function statusDotClass(input: boolean | null | StepResult): string {
  if (input === null) return "bg-muted-foreground/30";
  if (typeof input === "boolean") {
    return input ? "bg-success" : "bg-destructive";
  }
  if (input.ok) return "bg-success";
  // 401 routes the verdict to AUTH (blue); the failing steps that produced it
  // should match so the row colors line up with the verdict chip.
  if (input.error?.code === "UNAUTHORIZED") return "bg-info";
  return "bg-destructive";
}

export function originOf(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return url;
  }
}

export function formatTimestamp(date: Date): string {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  });
}

/**
 * Pretty-print whatever the server actually returned. The runtime body can be:
 *  - a JSON document (application/json)
 *  - one or more SSE frames, each carrying a JSON payload after `data:`
 *  - a non-JSON blob (HTML, plain text) — passed through unchanged
 * Truncation suffix `…[truncated]` is preserved so the reader sees the cap.
 */
export function formatResponseBody(raw: string | undefined): string {
  if (!raw) return "";
  const trimmed = raw.trim();
  if (!trimmed) return raw;

  const TRUNCATED = "…[truncated]";
  const wasTruncated = trimmed.endsWith(TRUNCATED);
  const body = wasTruncated ? trimmed.slice(0, -TRUNCATED.length) : trimmed;
  const suffix = wasTruncated ? `\n${TRUNCATED}` : "";

  const direct = tryPrettyJson(body);
  if (direct) return direct + suffix;

  const sseFrames = extractSseDataFrames(body);
  if (sseFrames.length > 0) {
    return sseFrames.join("\n\n") + suffix;
  }
  return raw;
}

function tryPrettyJson(input: string): string | null {
  try {
    return JSON.stringify(JSON.parse(input), null, 2);
  } catch {
    return null;
  }
}

function extractSseDataFrames(input: string): string[] {
  const frames: string[] = [];
  let dataLines: string[] = [];
  const flush = () => {
    if (dataLines.length === 0) return;
    const payload = dataLines.join("\n");
    dataLines = [];
    const pretty = tryPrettyJson(payload);
    frames.push(pretty ?? payload);
  };
  for (const rawLine of input.split(/\r?\n/)) {
    if (rawLine === "") {
      flush();
      continue;
    }
    if (rawLine.startsWith("data:")) {
      dataLines.push(rawLine.slice(5).replace(/^\s/, ""));
    }
  }
  flush();
  return frames;
}
