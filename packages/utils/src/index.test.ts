import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";

import { transformHeaders } from "./index";

describe("transformHeaders", () => {
  it("keeps the __proto__ header in outgoing requests", () => {
    const headers = transformHeaders([
      { key: "__proto__", value: "custom-value" },
    ]);
    const request = new Request("https://example.com", {
      headers: { "Content-Type": "application/json", ...headers },
    });

    expect(new Headers(headers).get("__proto__")).toBe("custom-value");
    expect(request.headers.get("__proto__")).toBe("custom-value");
  });
});
