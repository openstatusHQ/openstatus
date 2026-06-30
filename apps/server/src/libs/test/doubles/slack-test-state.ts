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
  runAgentOverride: (() => Promise<unknown>) | null;
  repliesImpl: () => Promise<unknown>;
}

const g = globalThis as Record<string, unknown>;
if (!g.__slackTestState) {
  g.__slackTestState = {
    resolveWorkspace: () => Promise.resolve(null),
    calls: [],
    postMessageOverride: null,
    updateOverride: null,
    postEphemeralOverride: null,
    runAgentOverride: null,
    repliesImpl: () =>
      Promise.resolve({
        messages: [{ user: "U1", text: "test message", ts: "1.1" }],
      }),
  } satisfies SlackTestState;
}

export const slackTestState = g.__slackTestState as SlackTestState;
