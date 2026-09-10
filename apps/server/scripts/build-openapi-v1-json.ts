/**
 * `static/openapi-v1.json` is served in production instead of generating the
 * v1 document per request. Re-run after changing v1 routes or error responses:
 * `pnpm --filter @openstatus/server openapi:v1`
 */
import { api, openapiV1Config } from "../src/routes/v1/index.ts";

const doc = api.getOpenAPIDocument(openapiV1Config);
await Deno.writeTextFile(
  new URL("../static/openapi-v1.json", import.meta.url),
  `${JSON.stringify(doc, null, 2)}\n`,
);
