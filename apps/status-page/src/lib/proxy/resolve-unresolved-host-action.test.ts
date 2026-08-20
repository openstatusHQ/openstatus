import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

import {
  NOT_FOUND_PATH,
  resolveUnresolvedHostAction,
} from "./resolve-unresolved-host-action";

const ORIGIN = "https://www.stpg.dev";

function run(host: string | null, urlHost = "www.stpg.dev", path = "/") {
  return resolveUnresolvedHostAction({
    host,
    urlHost,
    requestUrl: `${ORIGIN}${path}`,
  });
}

describe("resolveUnresolvedHostAction", () => {
  describe("hosts that must 404 instead of seeing the theme explorer", () => {
    test("custom domain pointed at the deployment but missing from `page`", () => {
      const action = run("status.mxkaske.dev");
      expect(action.type).toBe("rewrite");
      expect(action.reason).toBe("unresolved-host");
      expect(action.url?.pathname).toBe(NOT_FOUND_PATH);
    });

    test("unknown tenant subdomain", () => {
      expect(run("does-not-exist.openstatus.dev").type).toBe("rewrite");
      expect(run("does-not-exist.stpg.dev").type).toBe("rewrite");
    });

    test("apex and `www.` custom domains", () => {
      expect(run("mxkaske.dev").type).toBe("rewrite");
      expect(run("www.mxkaske.dev").type).toBe("rewrite");
    });

    test("the marketing host", () => {
      expect(run("www.openstatus.dev").type).toBe("rewrite");
    });

    test("the 404 target drops the original path and query", () => {
      const action = run("status.mxkaske.dev", "www.stpg.dev", "/events?a=1");
      expect(action.url?.pathname).toBe(NOT_FOUND_PATH);
      expect(action.url?.search).toBe("");
    });
  });

  describe("hosts that render the explorer", () => {
    test("the canonical theme explorer host", () => {
      const action = run("themes.openstatus.dev");
      expect(action.type).toBe("passthrough");
      expect(action.reason).toBe("theme-explorer-host");
      expect(action.url).toBe(undefined);
    });

    test("the internal origin", () => {
      expect(run("www.stpg.dev").type).toBe("passthrough");
    });

    test("local dev", () => {
      expect(run("localhost:3000", "localhost:3000").type).toBe("passthrough");
    });

    test("preview deployments", () => {
      expect(run("os-abc123.vercel.app", "os-abc123.vercel.app").type).toBe(
        "passthrough",
      );
    });
  });

  describe("host resolution", () => {
    test("falls back to urlHost when x-forwarded-host is absent", () => {
      expect(run(null, "themes.openstatus.dev").type).toBe("passthrough");
      expect(run(null, "status.mxkaske.dev").type).toBe("rewrite");
    });

    test("x-forwarded-host wins over urlHost", () => {
      // The origin every proxied host lands on is allowed; the forwarded
      // tenant host is what must 404.
      expect(run("status.mxkaske.dev", "www.stpg.dev").type).toBe("rewrite");
    });
  });
});
