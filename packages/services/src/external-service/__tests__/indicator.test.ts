import {
  externalIndicatorToStatus,
  worstExternalIndicator,
} from "@openstatus/db/src/schema";
import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

describe("externalIndicatorToStatus", () => {
  test("maps indicators onto the status-page palette", () => {
    expect(externalIndicatorToStatus("none")).toBe("success");
    expect(externalIndicatorToStatus("minor")).toBe("degraded");
    expect(externalIndicatorToStatus("major")).toBe("error");
    expect(externalIndicatorToStatus("critical")).toBe("error");
  });

  test("maintenance shows on operational/no-data, never masks an outage", () => {
    expect(externalIndicatorToStatus("none", true)).toBe("info");
    expect(externalIndicatorToStatus("", true)).toBe("info");
    expect(externalIndicatorToStatus("minor", true)).toBe("degraded");
    expect(externalIndicatorToStatus("major", true)).toBe("error");
    expect(externalIndicatorToStatus("critical", true)).toBe("error");
  });

  test("unknown indicator is empty (no data)", () => {
    expect(externalIndicatorToStatus("")).toBe("empty");
    expect(externalIndicatorToStatus("bogus")).toBe("empty");
  });
});

describe("worstExternalIndicator", () => {
  test("returns the worst by severity", () => {
    expect(worstExternalIndicator(["none", "minor", "major"])).toBe("major");
    expect(worstExternalIndicator(["minor", "critical", "none"])).toBe(
      "critical",
    );
    expect(worstExternalIndicator(["none", "none"])).toBe("none");
  });

  test("empty set yields no indicator", () => {
    expect(worstExternalIndicator([])).toBe("");
  });
});
