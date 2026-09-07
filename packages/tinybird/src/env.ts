/**
 * `NODE_ENV`, read so that bundlers cannot fold it away.
 *
 * `deno bundle` (esbuild) rewrites the exact expression `process.env.NODE_ENV`
 * to a string literal at build time — `"development"` unless `--minify` is
 * passed, and `apps/server` bundles without it (see `apps/server/dofigen.yml`).
 * Reading through an aliased object defeats that substitution, so the value
 * comes from the real environment at runtime.
 */
export const env = {
  get NODE_ENV(): string {
    const processEnv: Record<string, string | undefined> = process.env;
    return processEnv.NODE_ENV ?? "development";
  },
};
