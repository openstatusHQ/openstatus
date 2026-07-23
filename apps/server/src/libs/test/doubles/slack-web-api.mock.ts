// Test double for @slack/web-api (only WebClient is used), swapped in via
// --import-map. Captures chat calls into the shared slack test state.
import { slackTestState as s } from "./slack-test-state.ts";

export class WebClient {
  chat = {
    postMessage: (args: Record<string, unknown>) => {
      if (s.postMessageOverride) return s.postMessageOverride(args);
      s.calls.push({ method: "postMessage", args });
      return Promise.resolve({ ts: "msg.ts" });
    },
    update: (args: Record<string, unknown>) => {
      if (s.updateOverride) return s.updateOverride(args);
      s.calls.push({ method: "update", args });
      return Promise.resolve({ ts: "msg.ts" });
    },
    postEphemeral: (args: Record<string, unknown>) => {
      if (s.postEphemeralOverride) return s.postEphemeralOverride(args);
      s.calls.push({ method: "postEphemeral", args });
      return Promise.resolve();
    },
  };
  conversations = {
    replies: () => s.repliesImpl(),
  };
  views = {
    publish: (args: Record<string, unknown>) => {
      s.calls.push({ method: "views.publish", args });
      return Promise.resolve({ ok: true });
    },
  };
}
