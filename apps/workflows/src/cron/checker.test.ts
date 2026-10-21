import { describe, expect, test, vi } from "vitest";

import { env } from "../env";
import { isAuthorizedDomain } from "./checker";

// the module opens an embedded replica file on import; these tests never query
vi.mock("../lib/db", () => ({ db: {} }));

describe("isAuthorizedDomain", () => {
  test("accepts urls on the site domain only", () => {
    expect(isAuthorizedDomain(`${env().SITE_URL}/api/checker`)).toBe(true);
    expect(isAuthorizedDomain("https://example.com/api/checker")).toBe(false);
  });
});
