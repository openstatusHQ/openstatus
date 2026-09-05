import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { expect } from "@std/expect";
import { afterEach, describe, test } from "@std/testing/bdd";

import { PUBLIC_RESOURCES, readPublicResource } from "./resources";
import { createPublicMcpServer } from "./server";

const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
});

function stubFetch(impl: () => Promise<Response>) {
  globalThis.fetch = impl as unknown as typeof fetch;
}

describe("public MCP resources", () => {
  test("every entry is addressable and typed", () => {
    expect(PUBLIC_RESOURCES.length).toBeGreaterThan(0);
    const names = new Set<string>();
    for (const resource of PUBLIC_RESOURCES) {
      expect(resource.uri.startsWith("https://")).toBe(true);
      expect(resource.mimeType.length).toBeGreaterThan(0);
      expect(resource.description.length).toBeGreaterThan(0);
      expect(names.has(resource.name)).toBe(false);
      names.add(resource.name);
    }
  });

  test("reads echo the declared uri and mimeType", async () => {
    stubFetch(() => Promise.resolve(new Response("# doc")));
    for (const resource of PUBLIC_RESOURCES) {
      const result = await readPublicResource(resource);
      expect(result.contents).toHaveLength(1);
      expect(result.contents[0].uri).toBe(resource.uri);
      expect(result.contents[0].mimeType).toBe(resource.mimeType);
    }
  });

  test("never returns an empty body when the document is unreachable", async () => {
    stubFetch(() => Promise.reject(new Error("network down")));
    for (const resource of PUBLIC_RESOURCES) {
      const result = await readPublicResource(resource);
      expect(String(result.contents[0].text).length).toBeGreaterThan(0);
    }
  });

  test("falls back rather than serving a blank document", async () => {
    const remote = PUBLIC_RESOURCES.find((r) => r.name === "site-index");
    if (!remote) throw new Error("site-index resource missing");

    stubFetch(() => Promise.resolve(new Response("   ")));
    const blank = await readPublicResource(remote);
    expect(String(blank.contents[0].text).trim().length).toBeGreaterThan(0);

    stubFetch(() =>
      Promise.resolve(new Response("not found", { status: 404 })),
    );
    const missing = await readPublicResource(remote);
    expect(String(missing.contents[0].text).trim().length).toBeGreaterThan(0);
  });

  test("serves the fetched document when it resolves", async () => {
    const remote = PUBLIC_RESOURCES.find(
      (r) => r.name === "mcp-server-reference",
    );
    if (!remote) throw new Error("mcp-server-reference resource missing");

    stubFetch(() => Promise.resolve(new Response("# MCP server\n\nlive copy")));
    const result = await readPublicResource(remote);
    expect(result.contents[0].text).toContain("live copy");
  });

  test("ships the OpenAPI document without a network call", async () => {
    stubFetch(() => Promise.reject(new Error("must not be called")));
    const spec = PUBLIC_RESOURCES.find(
      (r) => r.name === "openapi-specification",
    );
    if (!spec) throw new Error("openapi resource missing");

    const result = await readPublicResource(spec);
    const parsed = JSON.parse(String(result.contents[0].text));
    expect(parsed.openapi).toBe("3.1.0");
    expect(parsed.servers[0].url).toBe("https://api.openstatus.dev");
  });
});

/** Connect a client to the anonymous server the route actually builds. */
async function connectPublicServer() {
  const server = createPublicMcpServer();
  const client = new Client({ name: "probe", version: "test" });
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);
  return { client, close: () => client.close() };
}

describe("anonymous MCP surface", () => {
  test("advertises the resources capability on initialize", async () => {
    stubFetch(() => Promise.resolve(new Response("# doc")));
    const { client, close } = await connectPublicServer();
    try {
      expect(client.getServerCapabilities()?.resources).toBeDefined();
      expect(client.getServerCapabilities()?.tools).toBeUndefined();
    } finally {
      await close();
    }
  });

  test("resources/list returns every public document", async () => {
    stubFetch(() => Promise.resolve(new Response("# doc")));
    const { client, close } = await connectPublicServer();
    try {
      const { resources } = await client.listResources();
      expect(resources.map((r) => r.uri).sort()).toEqual(
        PUBLIC_RESOURCES.map((r) => r.uri).sort(),
      );
      for (const resource of resources) {
        expect(resource.name.length).toBeGreaterThan(0);
        expect(resource.description?.length).toBeGreaterThan(0);
        expect(resource.mimeType?.length).toBeGreaterThan(0);
      }
    } finally {
      await close();
    }
  });

  test("resources/read returns a non-empty body for each", async () => {
    stubFetch(() => Promise.resolve(new Response("# doc")));
    const { client, close } = await connectPublicServer();
    try {
      for (const resource of PUBLIC_RESOURCES) {
        const result = await client.readResource({ uri: resource.uri });
        expect(String(result.contents[0].text).length).toBeGreaterThan(0);
      }
    } finally {
      await close();
    }
  });

  test("exposes no tools without a key", async () => {
    stubFetch(() => Promise.resolve(new Response("# doc")));
    const { client, close } = await connectPublicServer();
    try {
      await expect(client.listTools()).rejects.toThrow();
    } finally {
      await close();
    }
  });
});
