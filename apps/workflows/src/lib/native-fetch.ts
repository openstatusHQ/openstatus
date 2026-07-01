// google-gax (Cloud Tasks) routes through node-fetch unless `window.fetch` exists,
// and node-fetch on Deno's node:http shim costs ~5x the CPU of native fetch.
// Aliasing window to globalThis exposes window.fetch so google-gax picks native fetch.
// It must be globalThis (not a bare {fetch}) so @t3-oss/env's `"Deno" in window`
// server-detection still sees Deno and treats this as a server, not the browser.
(globalThis as { window?: unknown }).window ??= globalThis;
