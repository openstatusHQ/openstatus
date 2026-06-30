// Test double for slack/workspace-resolver.ts (hits the db), swapped in via
// --import-map. Delegates to the per-test resolver in the shared slack state.
import { slackTestState } from "./slack-test-state.ts";

export const resolveWorkspace = (teamId: string) =>
  slackTestState.resolveWorkspace(teamId);
