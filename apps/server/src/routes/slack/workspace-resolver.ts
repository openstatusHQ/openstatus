import {
  resolveSlackTeamWorkspace,
  type SlackWorkspace,
} from "@openstatus/services/integration";

export type { SlackWorkspace };

export function resolveWorkspace(
  teamId: string,
): Promise<SlackWorkspace | null> {
  return resolveSlackTeamWorkspace(teamId);
}
