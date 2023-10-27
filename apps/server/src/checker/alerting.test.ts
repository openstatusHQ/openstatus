import { expect, it, vi } from "vitest";

import { triggerAlerting } from "./alerting";
import * as utils from "./utils";

it("should send email notification", async () => {
  vi.mock("utils");
  const mockedFn = vi.fn();
  utils.providerToFunction["email"] = mockedFn;
  await triggerAlerting({ monitorId: "1" });
  expect(mockedFn).toHaveBeenCalledTimes(1);
});
