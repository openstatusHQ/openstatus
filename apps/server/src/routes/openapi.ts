import { Hono } from "hono";

import openapiV1Json from "../../static/openapi-v1.json" with { type: "json" };
import openapiJson from "../../static/openapi.json" with { type: "json" };

const openapiYaml = await Deno.readTextFile(
  new URL("../../static/openapi.yaml", import.meta.url),
);

// Serialized once: the documents are ~320 KB and never change at runtime.
const openapiJsonBody = JSON.stringify(openapiJson);
const openapiV1JsonBody = JSON.stringify(openapiV1Json);

// The specs are public and unauthenticated; an agent fetching one from a
// browser needs the CORS header to read the body at all.
const specHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "public, max-age=3600",
};

/**
 * The machine-readable API descriptions. `openapi.json` is the path agents and
 * OpenAPI tooling probe by convention; `openapi.yaml` is the generated source
 * both are rendered from (see `scripts/build-openapi-json.ts`).
 */
export const openapiRoute = new Hono({ strict: false });

openapiRoute.get("/openapi.yaml", (c) =>
  c.text(openapiYaml, 200, {
    "Content-Type": "application/yaml",
    ...specHeaders,
  }),
);

openapiRoute.get("/openapi.json", (c) =>
  c.text(openapiJsonBody, 200, {
    "Content-Type": "application/json",
    ...specHeaders,
  }),
);

openapiRoute.get("/openapi-v1.json", (c) =>
  c.text(openapiV1JsonBody, 200, {
    "Content-Type": "application/json",
    ...specHeaders,
  }),
);
