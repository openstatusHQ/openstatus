/** Bot scopes the Slack app requests; the manifest lists the same set. */
export const SLACK_BOT_SCOPES = [
  "app_mentions:read",
  "assistant:write",
  "channels:history",
  "channels:join",
  "channels:manage",
  "channels:write.invites",
  "chat:write",
  "commands",
  "groups:history",
  "groups:read",
  "groups:write",
  "im:history",
  "pins:write",
  "reactions:read",
  "reactions:write",
  "users:read",
  "users:read.email",
] as const;

/** Scopes the install lacks, from the comma list Slack returned at OAuth. */
export function missingSlackScopes(granted: string | undefined): string[] {
  const have = new Set(
    (granted ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
  return SLACK_BOT_SCOPES.filter((scope) => !have.has(scope));
}
