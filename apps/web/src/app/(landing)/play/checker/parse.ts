import {
  type Timing,
  is32CharHex,
  regionCheckerSchemaResponse,
} from "../../../../lib/checker/utils";

export type CheckerSuccess = {
  region: string;
  latency: number;
  status: number;
  timing: Timing;
};

export type CheckerFailure = {
  region: string;
  message: string;
};

export type CheckerLine =
  | { type: "id"; id: string }
  | { type: "success"; value: CheckerSuccess }
  | { type: "failure"; value: CheckerFailure };

export function parseCheckerLine(line: string): CheckerLine | null {
  if (is32CharHex(line)) return { type: "id", id: line };

  let json: unknown;
  try {
    json = JSON.parse(line);
  } catch {
    return null;
  }

  const validation = regionCheckerSchemaResponse.safeParse(json);
  if (!validation.success) return null;

  const check = validation.data;
  if (check.state === "error") {
    return {
      type: "failure",
      value: { region: check.region, message: check.message },
    };
  }

  return {
    type: "success",
    value: {
      region: check.region,
      latency: check.latency,
      status: check.status,
      timing: check.timing,
    },
  };
}

// Reader chunks can end mid-line: keep the unfinished tail for the next read,
// and flush it once the stream is done (the result id has no trailing newline).
export function splitStreamLines(
  buffer: string,
  done: boolean,
): { lines: string[]; rest: string } {
  const parts = buffer.split("\n");
  const rest = done ? "" : (parts.pop() ?? "");
  return { lines: parts.filter(Boolean), rest };
}
