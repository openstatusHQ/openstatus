import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

import { FIRING_RULE, NO_RULE_UID, RESOLVED_RULE } from "./fixtures";
import { grafanaAdapter } from "./index";

describe("grafana adapter", () => {
  test("maps a firing rule", () => {
    const alerts = grafanaAdapter.formatAlerts(FIRING_RULE);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].status).toBe("firing");
    expect(alerts[0].severity).toBe("warning");
    expect(alerts[0].title).toBe("p99 latency above 1s");
    expect(alerts[0].url).toBe("https://grafana.example.com/d/abc");
  });

  test("maps a resolved rule", () => {
    expect(grafanaAdapter.formatAlerts(RESOLVED_RULE)[0].status).toBe(
      "resolved",
    );
  });

  test("prefers the rule UID so firing and resolved pair up", () => {
    expect(grafanaAdapter.groupKey(FIRING_RULE)).toBe("ae5nxpzt2gowwd");
    expect(grafanaAdapter.groupKey(FIRING_RULE)).toBe(
      grafanaAdapter.groupKey(RESOLVED_RULE),
    );
  });

  test("falls back to group labels without a rule UID", () => {
    expect(grafanaAdapter.groupKey(NO_RULE_UID)).toBe("alertname=Legacy");
  });

  test("uses valueString as the description when none is set", () => {
    const alerts = grafanaAdapter.formatAlerts({
      status: "firing",
      alerts: [
        {
          status: "firing",
          labels: { alertname: "X" },
          annotations: {},
          valueString: "value=3",
        },
      ],
    });
    expect(alerts[0].description).toBe("value=3");
  });
});
