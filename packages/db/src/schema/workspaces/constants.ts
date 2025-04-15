export const workspacePlans = ["free", "starter", "team"] as const;
export const workspaceRole = ["owner", "admin", "member"] as const;

export const workspacePlanHierarchy: Record<
  (typeof workspacePlans)[number],
  number
> = {
  free: 0,
  starter: 1,
  team: 2,
};
