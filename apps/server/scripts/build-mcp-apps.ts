import { execFile } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { build } from "tsdown";

/**
 * Bundles each MCP App view under `mcp-apps/` into one self-contained HTML
 * document (hosts render it in a sandboxed iframe with no network access by
 * default) and embeds it as a module, for the same reason as `openapi-yaml.ts`:
 * tsdown flattens `src/` into one file, so a runtime path would not resolve.
 *
 * A view is a React app rendering `@openstatus/ui` components, so a change to a
 * shared chart reaches it on the next build; CI fails on a stale bundle. The
 * script and the Tailwind CSS are inlined.
 *
 * Run: `pnpm --filter @openstatus/server mcp-apps:build`
 */
const root = new URL("../", import.meta.url);
const run = promisify(execFile);

// Every folder is a view, except `_shared` and other underscore-prefixed kits.
const APPS = (
  await readdir(new URL("mcp-apps/", root), { withFileTypes: true })
)
  .filter((entry) => entry.isDirectory() && !entry.name.startsWith("_"))
  .map((entry) => entry.name)
  .sort();

for (const name of APPS) {
  const dir = new URL(`mcp-apps/${name}/`, root);
  const outDir = await mkdtemp(join(tmpdir(), `mcp-app-${name}-`));
  try {
    await build({
      config: false,
      entry: { main: fileURLToPath(new URL("main.tsx", dir)) },
      outDir,
      format: "esm",
      platform: "browser",
      target: "es2022",
      minify: true,
      dts: false,
      clean: false,
      logLevel: "error",
      define: { "process.env.NODE_ENV": JSON.stringify("production") },
      outExtensions: () => ({ js: ".js" }),
      deps: { alwaysBundle: [/.*/], onlyBundle: false },
    });
    await run(
      "pnpm",
      [
        "exec",
        "tailwindcss",
        "--input",
        fileURLToPath(new URL("styles.css", dir)),
        "--output",
        join(outDir, "styles.css"),
        "--minify",
      ],
      { cwd: fileURLToPath(root) },
    );
    const [template, css, js] = await Promise.all([
      readFile(new URL("index.html", dir), "utf8"),
      readFile(join(outDir, "styles.css"), "utf8"),
      readFile(join(outDir, "main.js"), "utf8"),
    ]);
    // function replacers: `$&` and friends in the bundle must stay literal
    const html = template
      .replace("/*__STYLE__*/", () => css.replaceAll("</style", "<\\/style"))
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
