// Test double for @openstatus/analytics, swapped in via --import-map. Keeps the
// real Events/parseInputToProps but replaces setupAnalytics with a spy (exposed
// on globalThis.__analyticsSpies) so tests assert tracking without OpenPanel.
export {
  type EventProps,
  Events,
  parseInputToProps,
} from "@openstatus/analytics-real";

import { mock } from "@openstatus/test-utils";

const g = globalThis as Record<string, unknown>;
if (!g.__analyticsSpies) {
  const track = mock(() => Promise.resolve());
  g.__analyticsSpies = {
    track,
    setupAnalytics: mock((_props: unknown) => Promise.resolve({ track })),
  };
}

const spies = g.__analyticsSpies as {
  track: ReturnType<typeof mock>;
  setupAnalytics: ReturnType<typeof mock>;
};

export const setupAnalytics = (props: unknown) => spies.setupAnalytics(props);
