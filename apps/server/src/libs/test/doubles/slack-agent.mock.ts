// Test double for slack/agent.ts (pulls in the AI SDK), swapped in via
// --import-map so handler tests don't run the real agent.
import { slackTestState } from "./slack-test-state.ts";

export const runAgent = () => {
  if (slackTestState.runAgentOverride) return slackTestState.runAgentOverride();
  return Promise.resolve({ text: "Here is my response", toolResults: [] });
};
