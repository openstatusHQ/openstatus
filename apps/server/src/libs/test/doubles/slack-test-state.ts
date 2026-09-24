// Mutable per-test config shared by the slack module doubles below. Replaces
// the per-file bun `mock.module` closures (handler.test / interactions.test):
// each test sets the fields it needs in beforeEach and reads `calls`.
type SlackCall = { method: string; args: Record<string, unknown> };
type Override = ((args: Record<string, unknown>) => Promise<unknown>) | null;

export interface SlackTestState {
  resolveWorkspace: (teamId: string) => Promise<unknown>;
  calls: SlackCall[];
  postMessageOverride: Override;
  updateOverride: Override;
  postEphemeralOverride: Override;
  sessionStatusOverride: Override;
  renameOverride: Override;
  /** Set to false to simulate a workspace/SDK without message streaming. */
  chatStreamEnabled: boolean;
  /** Make appends start throwing once this many have succeeded. */
  streamAppendFailAfter: number | null;
  /** Receives runAgent's options, so a test can drive the stream or abort. */
  runAgentOverride: ((options?: unknown) => Promise<unknown>) | null;
  repliesImpl: () => Promise<unknown>;
  historyImpl: () => Promise<unknown>;
}

const g = globalThis as Record<string, unknown>;
if (!g.__slackTestState) {
  g.__slackTestState = {
    resolveWorkspace: () => Promise.resolve(null),
    calls: [],
    postMessageOverride: null,
    updateOverride: null,
    postEphemeralOverride: null,
    sessionStatusOverride: null,
    renameOverride: null,
    chatStreamEnabled: true,
    streamAppendFailAfter: null,
    runAgentOverride: null,
    repliesImpl: () =>
      Promise.resolve({
        messages: [{ user: "U1", text: "test message", ts: "1.1" }],
      }),
    historyImpl: () =>
      Promise.resolve({
        messages: [{ user: "U1", text: "channel message", ts: "1.1" }],
      }),
  } satisfies SlackTestState;
}

export const slackTestState = g.__slackTestState as SlackTestState;
