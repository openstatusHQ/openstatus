import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

// oxlint-disable-next-line typescript/no-non-null-assertion
const OPENAPI_PATH = join(dirname(import.meta.dirname!), "gen", "openapi.yaml");

const CONNECT_PARAMS = new Set([
  "Connect-Protocol-Version",
  "Connect-Timeout-Ms",
  "encoding",
  "base64",
  "compression",
  "connect",
]);

const CONNECT_SCHEMAS = new Set([
  "connect-protocol-version",
  "connect-timeout-header",
  "encoding",
  "base64",
  "compression",
  "connect",
]);

const lines = readFileSync(OPENAPI_PATH, "utf-8").split("\n");
const out: string[] = [];

let i = 0;
while (i < lines.length) {
  const line = lines[i];

  // Remove Connect-specific parameter blocks
  if (/^\s+- name:\s/.test(line)) {
    const nameMatch = line.match(/- name:\s+(.+)/);
    if (nameMatch && CONNECT_PARAMS.has(nameMatch[1].trim())) {
      const baseIndent = line.search(/\S/);
      i++;
      while (i < lines.length) {
        const nextLine = lines[i];
        if (nextLine.trim() === "") {
          i++;
          continue;
        }
        const nextIndent = nextLine.search(/\S/);
        if (nextIndent > baseIndent) {
          i++;
          continue;
        }
        break;
      }
      continue;
    }
  }

  // Remove Connect-specific schema definitions from components.schemas
  if (/^ {4}\S/.test(line) && line.trim().endsWith(":")) {
    const schemaName = line.trim().replace(/:$/, "");
    if (CONNECT_SCHEMAS.has(schemaName)) {
      const baseIndent = line.search(/\S/);
      i++;
      while (i < lines.length) {
        const nextLine = lines[i];
        if (nextLine.trim() === "") {
          i++;
          continue;
        }
        const nextIndent = nextLine.search(/\S/);
        if (nextIndent > baseIndent) {
          i++;
          continue;
        }
        break;
      }
      continue;
    }
  }

  out.push(line);
  i++;
}

// Second pass: remove empty "parameters:" keys left after stripping all params
const final: string[] = [];
for (let j = 0; j < out.length; j++) {
  if (/^\s+parameters:\s*$/.test(out[j])) {
    let k = j + 1;
    while (k < out.length && out[k].trim() === "") k++;
    if (k < out.length && /^\s+- name:/.test(out[k])) {
      final.push(out[j]);
    }
    continue;
  }
  final.push(out[j]);
}

// Every operation runs behind the rate limiter; the generator only emits per-RPC responses.
// The shared response lives here rather than in base.openapi.yaml because the plugin
// validates the base file before merging, so it cannot reference the generated connect.error schema.
const RATE_LIMITED_COMPONENT = [
  "  responses:",
  "    RateLimited:",
  "      description: Rate limit exceeded (Connect code resource_exhausted). Retry after the number of seconds in the Retry-After header. See https://www.openstatus.dev/docs/reference/api-rate-limits.",
  "      headers:",
  "        Retry-After:",
  "          description: Seconds to wait before retrying.",
  "          schema:",
  "            type: integer",
  "            example: 7",
  "      content:",
  "        application/json:",
  "          schema:",
  "            $ref: '#/components/schemas/connect.error'",
];
const RATE_LIMITED_REF = [
  '        "429":',
  "          $ref: '#/components/responses/RateLimited'",
];
const withRateLimit: string[] = [];
for (const line of final) {
  if (/^components:\s*$/.test(line)) {
    withRateLimit.push(line, ...RATE_LIMITED_COMPONENT);
    continue;
  }
  withRateLimit.push(line);
  if (/^      responses:\s*$/.test(line))
    withRateLimit.push(...RATE_LIMITED_REF);
}

const cleaned = withRateLimit.join("\n");
writeFileSync(OPENAPI_PATH, cleaned);

// Copy cleaned spec to server static directory
const serverOpenAPIPath = join(
  // oxlint-disable-next-line typescript/no-non-null-assertion
  dirname(import.meta.dirname!),
  "..",
  "..",
  "apps",
  "server",
  "static",
  "openapi.yaml",
);
writeFileSync(serverOpenAPIPath, cleaned);
