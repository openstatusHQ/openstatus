import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ReadResourceResult } from "@modelcontextprotocol/sdk/types.js";

import openapiJson from "../../../static/openapi.json" with { type: "json" };

const SPEC_BODY = JSON.stringify(openapiJson);
const FETCH_TIMEOUT_MS = 5_000;

type PublicResource = {
  name: string;
  uri: string;
  title: string;
  description: string;
  mimeType: string;
  read: () => Promise<string>;
};

/**
 * A `resources/read` must never resolve to an empty body — an empty resource
 * reads as a broken server and JSON-RPC has no "try later". Documents fetched
 * over the network fall back to a pointer at the same URI.
 */
async function fetchText(resource: {
  uri: string;
  title: string;
  mimeType: string;
}): Promise<string> {
  const fallback = `${resource.title} could not be fetched. Read it at ${resource.uri}.\n`;
  try {
    const res = await fetch(resource.uri, {
      headers: { Accept: resource.mimeType, "User-Agent": "openstatus-mcp" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return fallback;
    const body = (await res.text()).trim();
    return body.length > 0 ? body : fallback;
  } catch {
    return fallback;
  }
}

function remote(resource: Omit<PublicResource, "read">): PublicResource {
  return { ...resource, read: () => fetchText(resource) };
}

export const PUBLIC_RESOURCES: PublicResource[] = [
  {
    name: "openapi-specification",
    uri: "https://api.openstatus.dev/openapi.json",
    title: "openstatus OpenAPI specification",
    description:
      "Machine-readable description of the openstatus HTTP API: every operation with a unique operationId, typed parameters, and response schemas.",
    mimeType: "application/json",
    read: () => Promise.resolve(SPEC_BODY),
  },
  remote({
    name: "mcp-server-reference",
    uri: "https://www.openstatus.dev/docs/reference/mcp-server",
    title: "openstatus MCP server reference",
    description:
      "Transport, authentication, and the full tool list for this MCP server.",
    mimeType: "text/markdown",
  }),
  remote({
    name: "site-index",
    uri: "https://www.openstatus.dev/llms.txt",
    title: "openstatus site index for agents",
    description:
      "llms.txt: product context, pricing, and a linked index of every page on openstatus.dev.",
    mimeType: "text/plain",
  }),
];

export async function readPublicResource(
  resource: PublicResource,
): Promise<ReadResourceResult> {
  return {
    contents: [
      {
        uri: resource.uri,
        mimeType: resource.mimeType,
        text: await resource.read(),
      },
    ],
  };
}

/**
 * Registered on every server, authenticated or not: they carry no workspace
 * data, and they are what an anonymous client reads to learn how to
 * authenticate.
 */
export function registerPublicResources(server: McpServer): void {
  for (const resource of PUBLIC_RESOURCES) {
    server.registerResource(
      resource.name,
      resource.uri,
      {
        title: resource.title,
        description: resource.description,
        mimeType: resource.mimeType,
      },
      () => readPublicResource(resource),
    );
  }
}
