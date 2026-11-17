import { allPlans } from "@openstatus/db/src/schema/plan/config";
import { Region } from "@openstatus/proto/monitor/v1";
import { describe, expect, test } from "vitest";

import { checkMonitorConfigLimits } from "./limits";

describe("checkMonitorConfigLimits", () => {
  test("a region sent twice counts once against max-regions", () => {
    const limits = { ...allPlans.team.limits, "max-regions": 1 };
    expect(() =>
      checkMonitorConfigLimits(limits, undefined, [
        Region.FLY_AMS,
        Region.FLY_AMS,
      ]),
    ).not.toThrow();
    expect(() =>
      checkMonitorConfigLimits(limits, undefined, [
        Region.FLY_AMS,
        Region.FLY_IAD,
      ]),
    ).toThrow("Upgrade for more regions");
  });
});
