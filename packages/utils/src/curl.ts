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

  if (body) args.push(`--data-raw ${quote(body)}`);
  if (request.followRedirects) args.push("-L");
  if (request.timeout) args.push(`--max-time ${seconds(request.timeout)}`);

  return ["curl", ...args].join(" \\\n  ");
}
