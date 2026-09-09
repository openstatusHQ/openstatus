const DEFAULT_USER_AGENT = "OpenStatus/1.0";

export type CurlRequest = {
  url: string;
  method?: string | null;
  body?: string | null;
  headers?: { key: string; value: string }[] | null;
  followRedirects?: boolean | null;
  /** Milliseconds, as stored on the monitor. */
  timeout?: number | null;
};

function quote(value: string) {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

function seconds(milliseconds: number) {
  return String(Number((milliseconds / 1000).toFixed(3)));
}

/**
 * Renders the HTTP request a monitor performs as a runnable `curl` command,
 * mirroring the defaults `apps/checker` applies (user agent, POST content
 * type, redirect policy, timeout).
 */
export function buildCurlCommand(request: CurlRequest): string {
  const method = (request.method ?? "GET").toUpperCase();
  const body = request.body ?? "";
  const headers = (request.headers ?? []).filter((h) => h.key.trim() !== "");
  const hasHeader = (name: string) =>
    headers.some((h) => h.key.toLowerCase() === name);

  const args: string[] = [];

  // `--data-raw` on its own makes curl switch to POST, so a body needs `-X`.
  if (method !== "GET" || body) args.push(`-X ${method}`);
  args.push(quote(request.url));

  if (!hasHeader("user-agent")) {
    args.push(`-H ${quote(`User-Agent: ${DEFAULT_USER_AGENT}`)}`);
  }
  for (const header of headers) {
    args.push(`-H ${quote(`${header.key}: ${header.value}`)}`);
  }
  if (method === "POST" && !hasHeader("content-type")) {
    args.push(`-H ${quote("Content-Type: application/json")}`);
  }

  let command = "curl";
  if (
    method === "POST" &&
    headers.find((h) => h.key === "Content-Type")?.value ===
      "application/octet-stream"
  ) {
    const parts = body.split(",");
    const encoded = parts[1]?.replace(/[\r\n]/g, "");
    if (
      parts.length !== 2 ||
      encoded === undefined ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?(?![\s\S])/.test(
        encoded,
      )
    ) {
      return "printf '%s\\n' 'Invalid base64 data URL body' >&2; false";
    }
    const octal = atob(encoded).replace(
      /./gs,
      (byte) => `\\0${byte.charCodeAt(0).toString(8).padStart(3, "0")}`,
    );
    command = `printf %b ${quote(octal)} | curl`;
    args.push("--data-binary @-");
  } else if (body) {
    args.push(`--data-raw ${quote(body)}`);
  }
  if (request.followRedirects) args.push("-L");
  if (request.timeout) args.push(`--max-time ${seconds(request.timeout)}`);

  return [command, ...args].join(" \\\n  ");
}
