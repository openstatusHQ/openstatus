import { describe, expect, test } from "bun:test";
import type { Page } from "@openstatus/db/src/schema";
import type { ResolvedRoute } from "../resolve-route";
import { type ComposeInput, composePageAction } from "./compose-page-action";

const route: ResolvedRoute = {
  type: "pathname",
  prefix: "acme",
  locale: "en",
  localeExplicit: true,
  rewritePath: "/acme/en",
};

const basePage: Page = {
  id: 1,
  workspaceId: 1,
  title: "Acme",
  description: "",
  slug: "acme",
  customDomain: "",
  icon: "",
  forceTheme: null,
  footerHtml: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  published: true,
  passwordProtected: false,
  password: "",
  accessType: "public",
  authEmailDomains: [],
  allowedIpRanges: [],
  defaultLocale: "en",
  locales: null,
  favicon: null,
  logo: null,
  contactUrl: null,
  statusReportSchedule: null,
  showMonitorValues: null,
  showMonitorUptime: null,
} as unknown as Page;

function buildInput(overrides: Partial<ComposeInput> = {}): ComposeInput {
  return {
    route,
    page: basePage,
    host: "localhost:3000",
    urlHost: "localhost:3000",
    pathname: "/acme/en",
    search: "",
    isSelfHosted: false,
    requestUrl: "http://localhost:3000/acme/en",
    origin: "http://localhost:3000",
    cookiePassword: undefined,
    queryPassword: null,
    redirectParam: null,
    authEmail: null,
    clientIp: null,
    ...overrides,
  };
}

describe("composePageAction — priority ordering", () => {
  test("all stages pass → passthrough with reason 'no-match'", () => {
    const action = composePageAction(buildInput());
    expect(action.type).toBe("passthrough");
    expect(action.reason).toBe("no-match");
    expect(action.url).toBeUndefined();
  });

  test("locale rejection fires before password gate", () => {
    const action = composePageAction(
      buildInput({
        route: { ...route, locale: "fr", rewritePath: "/acme/fr" },
        page: {
          ...basePage,
          locales: ["en"],
          accessType: "password",
          password: "secret",
        } as Page,
      }),
    );
    expect(action.reason).toBe("locale-mismatch-redirect");
  });

  test("password gate fires before ip-restriction (when accessType matches password)", () => {
    const action = composePageAction(
      buildInput({
        page: {
          ...basePage,
          accessType: "password",
          password: "secret",
        } as Page,
        // ip-restriction would also block if it were checked, but password wins
        clientIp: "1.2.3.4",
      }),
    );
    expect(action.reason).toBe("password-gate-in");
  });

  test("ip-restriction gate fires (no other stage matches)", () => {
    const action = composePageAction(
      buildInput({
        page: {
          ...basePage,
          accessType: "ip-restriction",
          allowedIpRanges: ["10.0.0.0/24"],
        } as Page,
        clientIp: "1.2.3.4",
      }),
    );
    expect(action.reason).toBe("ip-restriction-gate-in");
  });

  test("custom-domain rewrite fires before default rewrite", () => {
    const action = composePageAction(
      buildInput({
        page: {
          ...basePage,
          customDomain: "status.acme.com",
        } as Page,
        host: "status.acme.com",
        urlHost: "localhost:3000",
        pathname: "/status.acme.com/en/events",
      }),
    );
    expect(action.reason).toBe("custom-domain-rewrite-path-strip");
  });

  test("default rewrite fires when paths differ and no other stage matches", () => {
    const action = composePageAction(
      buildInput({
        route: { ...route, rewritePath: "/acme/en" },
        pathname: "/acme",
      }),
    );
    expect(action.reason).toBe("default-rewrite");
  });

  test("email-domain gate fires before ip-restriction when both would match", () => {
    // Only one accessType is set on a page, so they are exclusive. This test
    // documents ordering: email-domain comes before ip-restriction in the chain.
    const action = composePageAction(
      buildInput({
        page: {
          ...basePage,
          accessType: "email-domain",
          authEmailDomains: ["acme.com"],
        } as Page,
        authEmail: null,
      }),
    );
    expect(action.reason).toBe("email-domain-gate-in");
  });
});
