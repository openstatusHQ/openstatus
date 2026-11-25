/**
 * `NODE_ENV`, read so that bundlers cannot fold it away: some replace the
 * exact expression `process.env.NODE_ENV` with a build-time literal. Reading
 * through an aliased object keeps it a runtime value.
 */
export const env = {
  get NODE_ENV(): string {
    const processEnv: Record<string, string | undefined> = process.env;
    return processEnv.NODE_ENV ?? "development";
  },
};
