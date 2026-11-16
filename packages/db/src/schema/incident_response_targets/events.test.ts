import { describe, expect, it } from "vitest";

import {
  formatIncidentTargetMinutes,
  incidentTargetBreachMessage,
  parseIncidentTargetBreachMessage,
  isIncidentSystemEvent,
} from "./events";

const dueAt = new Date("2026-11-11T13:00:00.000Z");

describe("formatIncidentTargetMinutes", () => {
  it.each([
    [30, "30m"],
    [60, "1h"],
    [90, "1h 30m"],
    [1440, "1d"],
    [2160, "1d 12h"],
    [43_200, "30d"],
  ])("%i minutes is %s", (minutes, value) => {
    expect(formatIncidentTargetMinutes(minutes)).toBe(value);
  });
});

describe("breach messages", () => {
  it("name the kind, the target and the due time", () => {
    expect(
      incidentTargetBreachMessage({
        kind: "response",
        targetMinutes: 240,
        dueAt,
      }),
    ).toBe("Response target of 4h breached, due 2026-11-11T13:00:00.000Z");
    expect(
      incidentTargetBreachMessage({
        kind: "resolution",
        targetMinutes: 1530,
        dueAt,
      }),
    ).toBe(
      "Resolution target of 1d 1h 30m breached, due 2026-11-11T13:00:00.000Z",
    );
  });

  it("parse back", () => {
    expect(
      parseIncidentTargetBreachMessage(
        "Resolution target of 1d 1h 30m breached, due 2026-11-11T13:00:00.000Z",
      ),
    ).toEqual({ kind: "resolution", target: "1d 1h 30m", dueAt });
  });

  it("parse an unknown shape or a bad date as null", () => {
    expect(parseIncidentTargetBreachMessage("Something else")).toBeNull();
    expect(
      parseIncidentTargetBreachMessage(
        "Response target of 4h breached, due yesterday",
      ),
    ).toBeNull();
    expect(parseIncidentTargetBreachMessage(null)).toBeNull();
  });
});

describe("isIncidentSystemEvent", () => {
  it("is true for the recorded misses only", () => {
    expect(isIncidentSystemEvent("response_target_breached")).toBe(true);
    expect(isIncidentSystemEvent("resolution_target_breached")).toBe(true);
    expect(isIncidentSystemEvent("note")).toBe(false);
    expect(isIncidentSystemEvent("acknowledged")).toBe(false);
  });
});
