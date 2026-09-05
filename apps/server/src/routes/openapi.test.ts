import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";
import { Hono } from "hono";
import { parse as parseYaml } from "jsr:@std/yaml@^1.0.9";

import openapiYaml from "../../static/openapi-yaml";
import openapiJson from "../../static/openapi.json" with { type: "json" };
import { openapiRoute } from "./openapi";

const app = new Hono().route("/", openapiRoute);

describe("OpenAPI documents", () => {
  test("openapi.json is a faithful rendering of openapi.yaml", async () => {
    const yaml = parseYaml(
      await Deno.readTextFile(
        new URL("../../static/openapi.yaml", import.meta.url),
      ),
    );
    expect(JSON.parse(JSON.stringify(openapiJson))).toEqual(yaml);
  });

  test("the embedded YAML module matches openapi.yaml on disk", async () => {
    expect(openapiYaml).toBe(
      await Deno.readTextFile(
        new URL("../../static/openapi.yaml", import.meta.url),
      ),
    );
  });

  test("declares the production server so agents can resolve paths", () => {
    expect(openapiJson.servers).toEqual([
      { url: "https://api.openstatus.dev", description: "Production" },
    ]);
  });

  test("GET /openapi.json serves a CORS-readable spec", async () => {
    const res = await app.request("/openapi.json");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    const body = await res.json();
    expect(body.openapi).toBe("3.1.0");
    expect(Object.keys(body.paths).length).toBeGreaterThan(0);
    expect(body.servers[0].url).toBe("https://api.openstatus.dev");
  });

  test("GET /openapi.yaml still serves YAML", async () => {
    const res = await app.request("/openapi.yaml");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/yaml");
    expect(await res.text()).toContain("openapi: 3.1.0");
  });

  test("GET /openapi-v1.json still serves the deprecated v1 spec", async () => {
    const res = await app.request("/openapi-v1.json");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.info.version).toBe("1.0.0");
  });
});
