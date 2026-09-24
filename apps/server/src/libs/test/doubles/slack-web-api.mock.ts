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
  // Mirrors ChatStreamer: `ts` is undefined until the first append or stop.
  chatStream = (args: Record<string, unknown>) => {
    if (!s.chatStreamEnabled) {
      throw new Error("chat streaming is not enabled for this workspace");
    }
    s.calls.push({ method: "chatStream", args });
    let ts: string | undefined;
    let appends = 0;
    return {
      get ts() {
        return ts;
      },
      append: (a: Record<string, unknown>) => {
        if (
          s.streamAppendFailAfter !== null &&
          appends >= s.streamAppendFailAfter
        ) {
          return Promise.reject(new Error("stream append failed"));
        }
        appends++;
        ts = "stream.ts";
        s.calls.push({ method: "stream.append", args: a });
        return Promise.resolve(null);
      },
      stop: (a?: Record<string, unknown>) => {
        ts = "stream.ts";
        s.calls.push({ method: "stream.stop", args: a ?? {} });
        if (s.streamStopFail) {
          return Promise.reject(new Error("stream already closed"));
        }
        return Promise.resolve({ ok: true, ts });
      },
    };
  };
  conversations = {
    replies: () => s.repliesImpl(),
    history: (args: Record<string, unknown>) => {
      s.calls.push({ method: "conversations.history", args });
      return s.historyImpl();
    },
  };
  agents = {
    sessions: {
      setStatus: (args: Record<string, unknown>) => {
        if (s.sessionStatusOverride) return s.sessionStatusOverride(args);
        s.calls.push({ method: "agents.sessions.setStatus", args });
        return Promise.resolve({ ok: true });
      },
      rename: (args: Record<string, unknown>) => {
        if (s.renameOverride) return s.renameOverride(args);
        s.calls.push({ method: "agents.sessions.rename", args });
        return Promise.resolve({ ok: true });
      },
    },
  };
  assistant = {
    threads: {
      setStatus: (args: Record<string, unknown>) => {
        s.calls.push({ method: "assistant.threads.setStatus", args });
        return Promise.resolve({ ok: true });
      },
    },
  };
  views = {
    publish: (args: Record<string, unknown>) => {
      s.calls.push({ method: "views.publish", args });
      return Promise.resolve({ ok: true });
    },
  };
}
