import { db, eq } from "@openstatus/db";
import { oauthClient, oauthGrant } from "@openstatus/db/src/schema";
import {
  createTestWorkspace,
  createUser,
} from "@openstatus/db/src/test/factories";
import {
  createSession,
  exchangeCode,
  pkceChallenge,
  registerClient,
  verifyAccessToken,
} from "@openstatus/services/oauth";
import { clearAuditLogFor } from "@openstatus/services/test/helpers";
import { expect } from "@std/expect";
import { afterAll, beforeAll, describe, test } from "@std/testing/bdd";
import { NextRequest } from "next/server.js";

import { edgeRouter } from "../edge";
import { createInnerTRPCContext, createTRPCContext } from "../trpc";

const VERIFIER = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
const REDIRECT = "http://localhost:43112/cb";

let workspaceId: number;
let workspaceSlug: string;
let ownerId: number;
let clientId: string;

beforeAll(async () => {
  const fixture = await createTestWorkspace({ plan: "team" });
  workspaceId = fixture.workspace.id;
  workspaceSlug = fixture.workspace.slug;
  ownerId = fixture.user.id;
  clientId = (
    await registerClient({
      input: { client_name: "Claude", redirect_uris: [REDIRECT] },
    })
  ).client_id;
});

afterAll(async () => {
  const grants = await db
    .select({ id: oauthGrant.id })
    .from(oauthGrant)
    .where(eq(oauthGrant.clientId, clientId))
    .all();
  await clearAuditLogFor({
    entityType: "oauth_grant",
    entityIds: grants.map((g) => g.id),
  });
  await db.delete(oauthClient).where(eq(oauthClient.clientId, clientId));
});

async function callerFor(userId: number) {
  const ctx = await createTRPCContext({
    req: new NextRequest("http://localhost:3000/api/trpc/edge", {
      headers: { cookie: `workspace-slug=${workspaceSlug}` },
    }),
    auth: async () => ({ user: { id: String(userId) } }),
  });
  return edgeRouter.createCaller(ctx);
}

async function newSession(scope = "read write", now?: Date) {
  const { id } = await createSession({
    now,
    input: {
      response_type: "code",
      client_id: clientId,
      redirect_uri: REDIRECT,
      scope,
      state: "st",
      code_challenge: await pkceChallenge(VERIFIER),
      code_challenge_method: "S256",
    },
  });
  return id;
}

describe("oauth router", () => {
  test("getSession and decide require a session", async () => {
    const caller = edgeRouter.createCaller(
      createInnerTRPCContext({ session: null }),
    );
    await expect(caller.oauth.getSession({ id: "x" })).rejects.toThrow(
      "UNAUTHORIZED",
    );
    await expect(
      caller.oauth.decide({ id: "x", approved: false }),
    ).rejects.toThrow("UNAUTHORIZED");
  });

  test("getSession returns the pending request and the user's workspaces", async () => {
    const caller = await callerFor(ownerId);
    const id = await newSession("read");
    const result = await caller.oauth.getSession({ id });
    expect(result.session.clientName).toBe("Claude");
    expect(result.session.scope).toEqual(["read"]);
    expect(result.workspaces.map((w) => w.id)).toContain(workspaceId);
  });

  test("getSession works for a user with no workspace", async () => {
    const orphan = await createUser();
    const caller = await callerFor(orphan.id);
    const id = await newSession();
    const result = await caller.oauth.getSession({ id });
    expect(result.workspaces).toEqual([]);
  });

  test("getSession maps expired sessions to PRECONDITION_FAILED", async () => {
    const caller = await callerFor(ownerId);
    const id = await newSession("read", new Date(Date.now() - 60 * 60 * 1000));
    await expect(caller.oauth.getSession({ id })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
  });

  test("a soft-deleted account cannot use the consent procedures", async () => {
    const ghost = await createUser({ deletedAt: new Date() });
    const caller = await callerFor(ghost.id);
    const id = await newSession();
    await expect(caller.oauth.getSession({ id })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  test("getSession maps decided and unknown sessions to tRPC errors", async () => {
    const caller = await callerFor(ownerId);
    await expect(
      caller.oauth.getSession({ id: "missing" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    const id = await newSession();
    await caller.oauth.decide({ id, approved: false });
    await expect(caller.oauth.getSession({ id })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
  });

  test("decide approve mints a code for the chosen workspace and scope", async () => {
    const caller = await callerFor(ownerId);
    const id = await newSession();
    const { redirectUrl } = await caller.oauth.decide({
      id,
      approved: true,
      workspaceId,
      scope: "read",
    });
    const url = new URL(redirectUrl);
    expect(url.searchParams.get("state")).toBe("st");
    const code = url.searchParams.get("code") ?? "";
    const tokens = await exchangeCode({
      input: { clientId, code, codeVerifier: VERIFIER, redirectUri: REDIRECT },
    });
    expect(tokens.scope).toBe("read");
    const verified = await verifyAccessToken(tokens.access_token);
    expect(verified?.workspaceId).toBe(workspaceId);
    expect(verified?.userId).toBe(ownerId);
  });

  test("decide rejects a workspace the caller does not belong to", async () => {
    const orphan = await createUser();
    const caller = await callerFor(orphan.id);
    const id = await newSession();
    await expect(
      caller.oauth.decide({ id, approved: true, workspaceId }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  test("listGrants and revokeGrant manage the workspace's connected apps", async () => {
    const caller = await callerFor(ownerId);
    const id = await newSession();
    const { redirectUrl } = await caller.oauth.decide({
      id,
      approved: true,
      workspaceId,
    });
    const code = new URL(redirectUrl).searchParams.get("code") ?? "";
    const tokens = await exchangeCode({
      input: { clientId, code, codeVerifier: VERIFIER, redirectUri: REDIRECT },
    });
    const grantId =
      (await verifyAccessToken(tokens.access_token))?.grantId ?? -1;

    const listed = await caller.oauth.listGrants();
    const found = listed.find((g) => g.id === grantId);
    expect(found?.clientName).toBe("Claude");
    expect(found?.user?.id).toBe(ownerId);

    await caller.oauth.revokeGrant({ grantId });
    expect(
      (await caller.oauth.listGrants()).find((g) => g.id === grantId),
    ).toBeUndefined();
    expect(await verifyAccessToken(tokens.access_token)).toBeNull();
    await expect(caller.oauth.revokeGrant({ grantId })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});
