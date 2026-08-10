import { db, eq } from "@openstatus/db";
import { page as pageTable, workspace } from "@openstatus/db/src/schema";
import { expect } from "@std/expect";
import { afterAll, beforeAll, describe, test } from "@std/testing/bdd";

import { createWorkspaceFixture } from "../../../test/helpers";
import type { ServiceContext } from "../../context";
import {
  ConflictError,
  ForbiddenError,
  InternalServiceError,
  PreconditionFailedError,
  ValidationError,
} from "../../errors";
import {
  createVercelClient,
  isVercelConfigured,
  toDomainError,
} from "../vercel";

const TEST_PREFIX = "svc-vercel-client-test";
let testWs: ServiceContext["workspace"];

beforeAll(async () => {
  const fixture = await createWorkspaceFixture("team");
  testWs = fixture.workspace;
});

afterAll(async () => {
  await db
    .delete(workspace)
    .where(eq(workspace.id, testWs.id))
    .catch(() => undefined);
});

describe("toDomainError", () => {
  test("maps domain_already_in_use to ConflictError", () => {
    const err = toDomainError("status.example.com", "domain_already_in_use");
    expect(err).toBeInstanceOf(ConflictError);
    expect(err.message).toContain("already in use");
  });

  test("maps invalid_domain and not_found to ValidationError", () => {
    const err1 = toDomainError("invalid..com", "invalid_domain");
    expect(err1).toBeInstanceOf(ValidationError);
    expect(err1.message).toContain("invalid");

    const err2 = toDomainError("notfound.com", "not_found");
    expect(err2).toBeInstanceOf(ValidationError);
  });

  test("maps forbidden and domain_taken to ForbiddenError", () => {
    const err1 = toDomainError("other.com", "forbidden");
    expect(err1).toBeInstanceOf(ForbiddenError);
    expect(err1.message).toContain("belongs to another team");

    const err2 = toDomainError("taken.com", "domain_taken");
    expect(err2).toBeInstanceOf(ForbiddenError);
  });

  test("maps unknown error code to InternalServiceError", () => {
    const err = toDomainError("status.example.com", "unknown_error");
    expect(err).toBeInstanceOf(InternalServiceError);
    expect(err.message).toContain("Failed to add custom domain");
  });
});

describe("isVercelConfigured", () => {
  test("returns true when projectId and bearerToken are provided", () => {
    expect(
      isVercelConfigured({
        projectId: "prj_123",
        bearerToken: "tok_123",
      }),
    ).toBe(true);
  });

  test("returns false when required credentials are missing", () => {
    expect(
      isVercelConfigured({
        projectId: "",
        bearerToken: "",
      }),
    ).toBe(false);
  });
});

describe("createVercelClient", () => {
  test("throws PreconditionFailedError if calling API when unconfigured", async () => {
    const client = createVercelClient({
      projectId: "",
      bearerToken: "",
    });

    let caught: unknown;
    try {
      await client.listDomains();
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(PreconditionFailedError);
  });

  test("addDomain successfully returns domain response", async () => {
    const mockFetch: typeof fetch = async (url, init) => {
      expect(String(url)).toContain("/v9/projects/prj_test/domains?teamId=team_test");
      expect(init?.method).toBe("POST");
      expect(JSON.parse(String(init?.body))).toEqual({
        name: "status.example.com",
      });

      return new Response(
        JSON.stringify({
          name: "status.example.com",
          verified: false,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    };

    const client = createVercelClient({
      projectId: "prj_test",
      teamId: "team_test",
      bearerToken: "tok_test",
      fetchFn: mockFetch,
    });

    const res = await client.addDomain("status.example.com");
    expect(res.name).toBe("status.example.com");
    expect(res.verified).toBe(false);
  });

  test("addDomain throws mapped ServiceError on API error", async () => {
    const mockFetch: typeof fetch = async () => {
      return new Response(
        JSON.stringify({
          error: { code: "domain_already_in_use", message: "In use" },
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    };

    const client = createVercelClient({
      projectId: "prj_test",
      teamId: "team_test",
      bearerToken: "tok_test",
      fetchFn: mockFetch,
    });

    let caught: unknown;
    try {
      await client.addDomain("status.example.com");
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ConflictError);
  });

  test("getConfig fetches domain configuration", async () => {
    const mockFetch: typeof fetch = async (url) => {
      expect(String(url)).toContain("/v6/domains/status.example.com/config?teamId=team_test");
      return new Response(
        JSON.stringify({
          configuredBy: "CNAME",
          misconfigured: false,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    };

    const client = createVercelClient({
      projectId: "prj_test",
      teamId: "team_test",
      bearerToken: "tok_test",
      fetchFn: mockFetch,
    });

    const res = (await client.getConfig("status.example.com")) as {
      configuredBy: string;
      misconfigured: boolean;
    };
    expect(res.configuredBy).toBe("CNAME");
    expect(res.misconfigured).toBe(false);
  });

  test("removeDomainIfUnused skips deletion when domain is held by another page", async () => {
    const customDomain = `${TEST_PREFIX}-holder.example.com`;

    const holderPage = await db
      .insert(pageTable)
      .values({
        workspaceId: testWs.id,
        title: "Holder Page",
        slug: `${TEST_PREFIX}-holder-slug`,
        description: "Holder",
        customDomain,
      })
      .returning()
      .get();

    let removeCalled = false;
    const mockFetch: typeof fetch = async () => {
      removeCalled = true;
      return new Response(JSON.stringify({}), { status: 200 });
    };

    const client = createVercelClient({
      projectId: "prj_test",
      teamId: "team_test",
      bearerToken: "tok_test",
      fetchFn: mockFetch,
    });

    // When excludePageId does NOT exclude the holder, it should skip removal
    const res = await client.removeDomainIfUnused(db, customDomain);
    expect(res).toBeNull();
    expect(removeCalled).toBe(false);

    // When excludePageId matches the holder, it should proceed to remove
    await client.removeDomainIfUnused(db, customDomain, {
      excludePageId: holderPage.id,
    });
    expect(removeCalled).toBe(true);

    await db
      .delete(pageTable)
      .where(eq(pageTable.id, holderPage.id))
      .catch(() => undefined);
  });
});
