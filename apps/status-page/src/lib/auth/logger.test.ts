import { InvalidCallbackUrl, UnknownAction } from "@auth/core/errors";
import { expect } from "@std/expect";
import { afterEach, describe, test } from "@std/testing/bdd";
import { type Stub, stub } from "@std/testing/mock";
import { AuthError } from "next-auth";

import { logger } from "./logger";

let errorStub: Stub | undefined;

afterEach(() => {
  errorStub?.restore();
});

describe("auth logger", () => {
  test("suppresses errors Auth.js rejects at the boundary", () => {
    errorStub = stub(console, "error");

    logger.error?.(new UnknownAction("Cannot handle action: '@@fw8EQ'"));
    logger.error?.(
      new InvalidCallbackUrl(
        "Invalid callback URL. Received: https://status.whitebit.com/%C0%A7",
      ),
    );

    expect(errorStub.calls).toHaveLength(0);
  });

  test("still logs other auth errors", () => {
    errorStub = stub(console, "error");

    logger.error?.(new AuthError("something else"));

    expect(errorStub.calls.length).toBeGreaterThan(0);
  });
});
