import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

import {
  ForbiddenError,
  InternalServiceError,
  NotFoundError,
  ServiceError,
  ValidationError,
} from "../errors";

describe("ServiceError.expected", () => {
  test("client faults are expected", () => {
    expect(new ValidationError("bad input").expected).toBe(true);
    expect(new NotFoundError("monitor", 1).expected).toBe(true);
    expect(new ForbiddenError("nope").expected).toBe(true);
  });

  test("our own failures are not", () => {
    expect(new InternalServiceError("boom").expected).toBe(false);
    expect(new ServiceError("INTERNAL", "boom").expected).toBe(false);
  });
});
