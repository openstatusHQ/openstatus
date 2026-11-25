import { describe, expect, test } from "vitest";

import type { Timeline } from "./timeline";
import { END, HOOK, updateSections } from "./update-layout";

const timeline = {
  name: "saml-sso",
  meta: { format: "update", title: "SAML SSO", tagline: "Sign in." },
  theme: "light",
  fps: 30,
  viewport: { width: 1440, height: 900 },
  scale: 2,
  duration: 12,
  events: [{ type: "click", t: 2, at: [0, 0], box: [0, 0, 10, 10] }],
} satisfies Timeline;

describe("updateSections", () => {
  const s = updateSections(timeline, {}, 30);

  test("opens the recording inside the hook and closes it into the end", () => {
    expect(s.bodyStart).toBe(s.hook - s.iris);
    expect(s.endStart).toBe(s.bodyStart + s.body - s.iris);
    expect(s.total).toBe(s.endStart + s.end);
  });

  test("adds less than the hook and the end card to the recording", () => {
    expect(s.total - s.body).toBeLessThan((HOOK + END) * 30);
  });
});
