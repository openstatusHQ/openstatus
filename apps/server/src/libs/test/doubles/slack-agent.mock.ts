// Test double for slack/agent.ts (pulls in the AI SDK), swapped in via
// --import-map so handler tests don't run the real agent.
import { slackTestState } from "./slack-test-state.ts";

// Signature mirrors the real runAgent so overrides can drive `events` and
// observe the abort signal.
export const runAgent = (
  _workspace?: unknown,
  _thread?: unknown,
  _botUserId?: unknown,
  _userText?: unknown,
  _origin?: unknown,
  options?: unknown,
) => {
  if (slackTestState.runAgentOverride) {
    return slackTestState.runAgentOverride(options);
  }
  return Promise.resolve({
    text: "Here is my response",
    toolResults: [],
    finishReason: "stop",
    stepCount: 1,
    hitStepLimit: false,
    aborted: false,
  });
};
