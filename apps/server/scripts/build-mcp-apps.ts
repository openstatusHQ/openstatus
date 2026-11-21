import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "tsdown";

/**
 * Bundles each MCP App view under `mcp-apps/` (its own files plus the
 * `_shared` kit and base stylesheet) into one self-contained HTML
 * document (hosts render it in a sandboxed iframe with no network access by
 * default) and embeds it as a module, for the same reason as `openapi-yaml.ts`:
 * tsdown flattens `src/` into one file, so a runtime path would not resolve.
 *
 * A view is ~430 kB (~110 kB gzipped), nearly all of it the ext-apps SDK and
 * zod. Accepted: the host reads it once per render and it never enters the
 * model's context, while a hand-rolled postMessage client would have to track
 * the protocol itself.
 *
 * Run: `pnpm --filter @openstatus/server mcp-apps:build`
 */
const root = new URL("../", import.meta.url);

// Every folder is a view, except `_shared` and other underscore-prefixed kits.
const APPS = (
  await readdir(new URL("mcp-apps/", root), { withFileTypes: true })
)
  .filter((entry) => entry.isDirectory() && !entry.name.startsWith("_"))
  .map((entry) => entry.name)
  .sort();
const baseCss = await readFile(
  new URL("mcp-apps/_shared/base.css", root),
  "utf8",
);

for (const name of APPS) {
  const dir = new URL(`mcp-apps/${name}/`, root);
  const outDir = await mkdtemp(join(tmpdir(), `mcp-app-${name}-`));
  try {
    await build({
      config: false,
      entry: { main: fileURLToPath(new URL("main.ts", dir)) },
      outDir,
      format: "esm",
      platform: "browser",
      target: "es2022",
      minify: true,
      dts: false,
      clean: false,
      logLevel: "warn",
      outExtensions: () => ({ js: ".js" }),
      deps: { alwaysBundle: [/.*/], onlyBundle: false },
    });
    const [template, css, js] = await Promise.all([
      readFile(new URL("index.html", dir), "utf8"),
      readFile(new URL("styles.css", dir), "utf8"),
      readFile(join(outDir, "main.js"), "utf8"),
    ]);
    // function replacers: `$&` and friends in the bundle must stay literal
    const html = template
      .replace("/*__STYLE__*/", () => baseCss + css)
      .replace("/*__SCRIPT__*/", () => js.replaceAll("</script", "<\\/script"));
    await writeFile(
      new URL(`static/mcp-app-${name}.ts`, root),
      `// Generated from mcp-apps/${name} — run \`pnpm --filter @openstatus/server mcp-apps:build\`.\nexport default ${JSON.stringify(html)};\n`,
    );
    console.log(`mcp-app-${name}: ${(html.length / 1024).toFixed(0)} kB`);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
}
