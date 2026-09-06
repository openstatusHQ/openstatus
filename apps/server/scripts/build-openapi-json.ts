import { parse } from "jsr:@std/yaml@^1.0.9";

/**
 * `static/openapi.json` is a JSON rendering of `static/openapi.yaml`, which is
 * itself generated from the protos (`pnpm --filter @openstatus/proto buf:openapi`).
 * Agents and OpenAPI tooling overwhelmingly expect `/openapi.json`; hand-editing
 * either file drifts them apart, which `openapi.test.ts` fails on.
 *
 * `openapi-yaml.ts` embeds the YAML as a module because `deno bundle` flattens
 * `src/` into a single file: a path resolved from `import.meta.url` at runtime
 * would point at the bundle's directory, not the source module's.
 *
 * Run: `pnpm --filter @openstatus/server openapi:json`
 */
const dir = new URL("../static/", import.meta.url);
const yaml = await Deno.readTextFile(new URL("openapi.yaml", dir));
await Deno.writeTextFile(
  new URL("openapi.json", dir),
  `${JSON.stringify(parse(yaml), null, 2)}\n`,
);
await Deno.writeTextFile(
  new URL("openapi-yaml.ts", dir),
  `// Generated from openapi.yaml — run \`pnpm --filter @openstatus/server openapi:json\`.\nexport default ${JSON.stringify(
    yaml,
  )};\n`,
);
