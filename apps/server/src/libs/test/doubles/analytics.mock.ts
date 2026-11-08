// Test double for @openstatus/analytics, swapped in via --import-map. Keeps the
// real Events/parseInputToProps but replaces setupAnalytics with a spy (exposed
// on globalThis.__analyticsSpies) so tests assert tracking without OpenPanel.
export {
  type Analytics,
  type EventProps,
  Events,
  type IdentifyProps,
  parseInputToProps,
} from "@openstatus/analytics-real";

import { vi, type Mock } from "vitest";

const g = globalThis as Record<string, unknown>;
if (!g.__analyticsSpies) {
  const track = vi.fn(() => Promise.resolve());
  g.__analyticsSpies = {
    track,
    setupAnalytics: vi.fn((_props: unknown) => Promise.resolve({ track })),
  };
}

const spies = g.__analyticsSpies as {
  track: Mock;
  setupAnalytics: Mock;
};

export const setupAnalytics = (props: unknown) => spies.setupAnalytics(props);
