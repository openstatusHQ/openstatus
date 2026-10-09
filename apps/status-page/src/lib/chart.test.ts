import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

import { getPayloadConfigFromPayload } from "./chart";

const config = {
  latency: { label: "Latency" },
  ams: { label: "Amsterdam" },
};

describe("getPayloadConfigFromPayload", () => {
  test("returns undefined for a non-object payload", () => {
    expect(
      getPayloadConfigFromPayload(config, null, "latency"),
    ).toBeUndefined();
    expect(getPayloadConfigFromPayload(config, "x", "latency")).toBeUndefined();
  });

  test("uses the key directly when the payload has no string override", () => {
    expect(
      getPayloadConfigFromPayload(config, { latency: 12 }, "latency"),
    ).toEqual({ label: "Latency" });
  });

  test("redirects through a string value on the payload", () => {
    expect(
      getPayloadConfigFromPayload(config, { name: "ams" }, "name"),
    ).toEqual({ label: "Amsterdam" });
  });

  test("redirects through a string value on the nested payload", () => {
    expect(
      getPayloadConfigFromPayload(
        config,
        { payload: { region: "ams" } },
        "region",
      ),
    ).toEqual({ label: "Amsterdam" });
  });

  test("prefers the top-level value over the nested one", () => {
    expect(
      getPayloadConfigFromPayload(
        config,
        { region: "latency", payload: { region: "ams" } },
        "region",
      ),
    ).toEqual({ label: "Latency" });
  });

  test("falls back to the key when the redirect is not in the config", () => {
    expect(
      getPayloadConfigFromPayload(config, { latency: "fra" }, "latency"),
    ).toEqual({ label: "Latency" });
  });
});
