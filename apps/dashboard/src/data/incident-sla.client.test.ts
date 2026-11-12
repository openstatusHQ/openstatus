import type { IncidentUpdateCadence } from "@openstatus/db/src/schema/incident_sla_policies/cadence";
import type { IncidentSlaTimer } from "@openstatus/db/src/schema/incident_sla_policies/state";
import { describe, expect, test } from "vitest";

import {
  parseSlaDuration,
  slaTimerPhrase,
  updateCadencePhrase,
} from "./incident-sla.client";

describe("parseSlaDuration", () => {
  test.each([
    ["30m", 30],
    ["4h", 240],
    ["3d", 4320],
    [" 1h 30m ", 90],
    ["1d12h", 2160],
    ["4H", 240],
  ])("%s is %i minutes", (value, minutes) => {
    expect(parseSlaDuration(value)).toEqual({ ok: true, minutes });
  });

  test("an empty field is off", () => {
    expect(parseSlaDuration("  ")).toEqual({ ok: true, minutes: undefined });
  });

  test.each(["4", "h", "4x", "1.5h", "-4h", "4h4h"])(
    "%s is not a duration",
    (value) => {
      expect(parseSlaDuration(value)).toEqual({ ok: false });
    },
  );
});

describe("slaTimerPhrase", () => {
  const startsAt = new Date("2026-11-11T12:00:00.000Z");
  const at = (minutes: number) =>
    new Date(startsAt.getTime() + minutes * 60_000);
  const timer: IncidentSlaTimer = {
    targetMinutes: 60,
    startsAt,
    dueAt: at(60),
    warnAt: at(45),
    metAt: null,
    breachDueAt: null,
    missReason: null,
    status: "running",
  };

  test.each([
    ["running", { status: "running" }, 10, "due in 50m"],
    ["at risk", { status: "at_risk" }, 50, "due in 10m"],
    ["breached", { status: "breached" }, 180, "breached 2h ago"],
    ["met at declare", { status: "met", metAt: startsAt }, 5, "met at declare"],
    ["met", { status: "met", metAt: at(4) }, 300, "met in 4m"],
    [
      "met late",
      { status: "breached", metAt: at(240), breachDueAt: at(60) },
      300,
      "met 3h late",
    ],
    ["due within the minute", { status: "at_risk" }, 59.9, "due in 1m"],
  ] as const)("%s", (_, patch, minutes, phrase) => {
    expect(slaTimerPhrase({ ...timer, ...patch }, at(minutes))).toBe(phrase);
  });
});

describe("updateCadencePhrase", () => {
  const startsAt = new Date("2026-11-11T12:00:00.000Z");
  const at = (minutes: number) =>
    new Date(startsAt.getTime() + minutes * 60_000);
  const cadence: IncidentUpdateCadence = {
    intervalMinutes: 120,
    startsAt,
    dueAt: at(120),
    warnAt: at(90),
    status: "running",
  };

  test.each([
    ["running", { status: "running" }, 56, "due in 1h 4m"],
    ["at risk", { status: "at_risk" }, 100, "due in 20m"],
    ["overdue", { status: "overdue" }, 165, "overdue by 45m"],
  ] as const)("%s", (_, patch, minutes, phrase) => {
    expect(updateCadencePhrase({ ...cadence, ...patch }, at(minutes))).toBe(
      phrase,
    );
  });
});
