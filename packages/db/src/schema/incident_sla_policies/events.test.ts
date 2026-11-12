import { describe, expect, it } from "vitest";

import {
  formatIncidentSlaMinutes,
  incidentSlaBreachMessage,
  incidentUpdateMissedMessage,
  parseIncidentSlaBreachMessage,
  parseIncidentUpdateMissedMessage,
} from "./events";

const dueAt = new Date("2026-11-11T13:00:00.000Z");

describe("formatIncidentSlaMinutes", () => {
  it.each([
    [30, "30m"],
    [60, "1h"],
    [90, "1h 30m"],
    [1440, "1d"],
    [2160, "1d 12h"],
    [43_200, "30d"],
  ])("%i minutes is %s", (minutes, value) => {
    expect(formatIncidentSlaMinutes(minutes)).toBe(value);
  });
});

describe("breach messages", () => {
  it("name the kind, the target and the due time", () => {
    expect(
      incidentSlaBreachMessage({ kind: "response", targetMinutes: 240, dueAt }),
    ).toBe("Response target of 4h breached, due 2026-11-11T13:00:00.000Z");
    expect(
      incidentSlaBreachMessage({
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
      parseIncidentSlaBreachMessage(
        "Resolution target of 1d 1h 30m breached, due 2026-11-11T13:00:00.000Z",
      ),
    ).toEqual({ kind: "resolution", target: "1d 1h 30m", dueAt });
  });

  it("parse an unknown shape or a bad date as null", () => {
    expect(parseIncidentSlaBreachMessage("Something else")).toBeNull();
    expect(
      parseIncidentSlaBreachMessage(
        "Response target of 4h breached, due yesterday",
      ),
    ).toBeNull();
    expect(parseIncidentSlaBreachMessage(null)).toBeNull();
  });
});

describe("missed update messages", () => {
  it("name the due time and the interval", () => {
    expect(incidentUpdateMissedMessage({ intervalMinutes: 240, dueAt })).toBe(
      "Update due 2026-11-11T13:00:00.000Z missed (every 4h)",
    );
  });

  it("parse back, and an unknown shape as null", () => {
    expect(
      parseIncidentUpdateMissedMessage(
        "Update due 2026-11-11T13:00:00.000Z missed (every 1h 30m)",
      ),
    ).toEqual({ interval: "1h 30m", dueAt });
    expect(parseIncidentUpdateMissedMessage("Update due soon")).toBeNull();
    expect(
      parseIncidentUpdateMissedMessage("Update due never missed (every 4h)"),
    ).toBeNull();
    expect(parseIncidentUpdateMissedMessage(null)).toBeNull();
  });
});
