import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

import {
  FIRING_GROUP,
  MULTI_ALERT_GROUP,
  NO_GROUP_KEY,
  RESOLVED_GROUP,
} from "./fixtures";
import { alertmanagerAdapter } from "./index";

describe("alertmanager adapter", () => {
  test("maps a firing group to one alert", () => {
    const alerts = alertmanagerAdapter.formatAlerts(FIRING_GROUP);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].status).toBe("firing");
    expect(alerts[0].severity).toBe("critical");
    expect(alerts[0].title).toBe("Error rate above 5%");
    expect(alerts[0].externalId).toBe("a1b2c3d4e5f60718");
    expect(alerts[0].labels.service).toBe("checkout");
    expect(alerts[0].startsAt?.toISOString()).toBe("2026-09-09T10:00:00.000Z");
  });

  test("maps a resolved group to resolved", () => {
    const alerts = alertmanagerAdapter.formatAlerts(RESOLVED_GROUP);
    expect(alerts[0].status).toBe("resolved");
  });

  test("firing and resolved share a group key so they pair up", () => {
    expect(alertmanagerAdapter.groupKey(FIRING_GROUP)).toBe(
      alertmanagerAdapter.groupKey(RESOLVED_GROUP),
    );
  });

  test("one webhook can carry several alerts", () => {
    const alerts = alertmanagerAdapter.formatAlerts(MULTI_ALERT_GROUP);
    expect(alerts).toHaveLength(2);
    expect(alerts.map((a) => a.severity)).toEqual(["critical", "warning"]);
  });

  test("falls back to sorted group labels when groupKey is absent", () => {
    expect(alertmanagerAdapter.groupKey(NO_GROUP_KEY)).toBe(
      "alertname=DiskFull,cluster=eu-1",
    );
  });

  test("unknown severity degrades to warning", () => {
    const alerts = alertmanagerAdapter.formatAlerts({
      status: "firing",
      alerts: [
        {
          status: "firing",
          labels: { alertname: "X", severity: "nonsense" },
          annotations: {},
        },
      ],
    });
    expect(alerts[0].severity).toBe("warning");
  });

  test("parseBody handles the raw JSON string", () => {
    const parsed = alertmanagerAdapter.parseBody(
      JSON.stringify(FIRING_GROUP),
      "application/json",
    );
    expect(alertmanagerAdapter.formatAlerts(parsed)).toHaveLength(1);
  });

  test("a malformed payload throws rather than silently mapping", () => {
    expect(() => alertmanagerAdapter.formatAlerts({ nope: true })).toThrow();
  });
});
