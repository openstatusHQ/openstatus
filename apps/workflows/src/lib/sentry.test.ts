import { describe, expect, test } from "@openstatus/test-utils";

import { clearFetchFailureStamps, shouldReportFetchFailure } from "./sentry";

const WINDOW_MS = 24 * 60 * 60 * 1000;

describe("shouldReportFetchFailure", () => {
  test("captures the first failure per fingerprint, then suppresses repeats within the window", () => {
    clearFetchFailureStamps();
    const now = 1_000_000;
    const fingerprint = "external-status-fetch:posthog:status:http:404";
    expect(shouldReportFetchFailure(fingerprint, now)).toBe(true);
    expect(shouldReportFetchFailure(fingerprint, now + WINDOW_MS - 1)).toBe(
      false,
    );
    expect(shouldReportFetchFailure(fingerprint, now + WINDOW_MS)).toBe(true);
  });

  test("a different slug, phase or status is a new failure", () => {
    clearFetchFailureStamps();
    const now = 1_000_000;
    expect(
      shouldReportFetchFailure(
        "external-status-fetch:posthog:status:http:404",
        now,
      ),
    ).toBe(true);
    expect(
      shouldReportFetchFailure(
        "external-status-fetch:posthog:status:http:403",
        now + 1,
      ),
    ).toBe(true);
    expect(
      shouldReportFetchFailure(
        "external-status-fetch:posthog:incidents:http:404",
        now + 2,
      ),
    ).toBe(true);
    expect(
      shouldReportFetchFailure(
        "external-status-fetch:fivetran:status:http:404",
        now + 3,
      ),
    ).toBe(true);
  });
});
