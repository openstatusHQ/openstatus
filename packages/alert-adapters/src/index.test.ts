import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

import { ALERT_ADAPTERS, getAlertAdapter } from "./index";

describe("registry", () => {
  test("every registered adapter is keyed by its own id", () => {
    for (const [key, adapter] of Object.entries(ALERT_ADAPTERS)) {
      expect(adapter.id).toBe(key);
    }
  });

  test("resolves a known provider and rejects an unknown one", () => {
    expect(getAlertAdapter("alertmanager")?.id).toBe("alertmanager");
    expect(getAlertAdapter("datadog")).toBe(null);
  });
});
