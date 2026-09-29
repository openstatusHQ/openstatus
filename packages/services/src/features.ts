import type { ServiceContext } from "./context";
import { ForbiddenError } from "./errors";
import type { Workspace } from "./types";

const featureWorkspaces = {
  "slack-agent": [1, 6850],
  "incident-management": [1, 6850],
} satisfies Record<string, ReadonlyArray<number>>;

export type Feature = keyof typeof featureWorkspaces;

export const FEATURES = Object.keys(featureWorkspaces) as Feature[];

// `OPENSTATUS_FEATURES` (comma list) turns a feature on for every workspace:
// local dev, self-hosting and test runs.
function featuresFromEnv(): Set<string> {
  const processEnv: Record<string, string | undefined> = process.env;
  const raw = processEnv.OPENSTATUS_FEATURES ?? "";
  return new Set(
    raw
      .split(",")
      .map((f) => f.trim())
      .filter(Boolean),
  );
}

export function isFeatureEnabled(
  workspace: Pick<Workspace, "id">,
  feature: Feature,
  envFeatures: Set<string> = featuresFromEnv(),
): boolean {
  const ids: ReadonlyArray<number> = featureWorkspaces[feature];
  return ids.includes(workspace.id) || envFeatures.has(feature);
}

export function enabledFeatures(workspace: Pick<Workspace, "id">): Feature[] {
  const envFeatures = featuresFromEnv();
  return FEATURES.filter((f) => isFeatureEnabled(workspace, f, envFeatures));
}

export function requireFeature(ctx: ServiceContext, feature: Feature): void {
  if (!isFeatureEnabled(ctx.workspace, feature)) {
    throw new ForbiddenError(`Feature not enabled: ${feature}`);
  }
}
