import { and, eq } from "@openstatus/db";
import {
  oauthAuthorizationCode,
  oauthClient,
  oauthGrant,
  oauthSession,
  user,
  usersToWorkspaces,
} from "@openstatus/db/src/schema";
import {
  addUserToWorkspace,
  createUser,
} from "@openstatus/db/src/test/factories";
import { expect } from "@std/expect";
import { beforeAll, describe, test } from "@std/testing/bdd";

import {
  createWorkspaceFixture,
  expectAuditRow,
  makeApiKeyCtx,
  makeUserCtx,
  readAuditLog,
  withTestTransaction,
} from "../../../test/helpers";
import type { DB, ServiceContext } from "../../context";
import {
  ForbiddenError,
  NotFoundError,
  PreconditionFailedError,
  ValidationError,
} from "../../errors";
import { removeMemberInWorkspace } from "../../member/internal";
import type { Workspace } from "../../types";
import { deleteAccount } from "../../user/delete";
import { pkceChallenge } from "../crypto";
import { OAuthError } from "../errors";
import {
  createSession,
  decideSession,
  exchangeCode,
  getSession,
  listGrants,
  pruneExpired,
  refreshGrant,
  registerClient,
  revokeGrant,
  revokeGrantsForUser,
  revokeToken,
  verifyAccessToken,
} from "../index";
import { revokeGrantRows } from "../internal";

const VERIFIER = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
const REDIRECT = "http://localhost:8765/callback";
const MINUTE = 60_000;

let team: Workspace;
let ownerId: number;
let other: Workspace;

beforeAll(async () => {
  const fixture = await createWorkspaceFixture("team");
  team = fixture.workspace;
  ownerId = fixture.userId;
  other = (await createWorkspaceFixture("free")).workspace;
});

async function register(tx: DB, name = "Test Client") {
  return registerClient({
    input: { client_name: name, redirect_uris: [REDIRECT] },
    db: tx,
  });
}

async function start(
  tx: DB,
  clientId: string,
  overrides: Record<string, string | undefined> = {},
  now?: Date,
) {
  return createSession({
    input: {
      response_type: "code",
      client_id: clientId,
      redirect_uri: REDIRECT,
      scope: "read write",
      state: "state-123",
      code_challenge: await pkceChallenge(VERIFIER),
      code_challenge_method: "S256",
      ...overrides,
    },
    db: tx,
    now,
  });
}

function codeFrom(redirectUrl: string): string {
  const code = new URL(redirectUrl).searchParams.get("code");
  if (!code) throw new Error(`no code in ${redirectUrl}`);
  return code;
}

async function consent(
  tx: DB,
  sessionId: string,
  userId: number,
  workspaceId: number,
  scope?: ("read" | "write")[],
  now?: Date,
) {
  const { redirectUrl } = await decideSession({
    input: { id: sessionId, approved: true, userId, workspaceId, scope },
    db: tx,
    now,
  });
  return codeFrom(redirectUrl);
}

async function mintGrant(
  tx: DB,
  args: {
    clientId: string;
    userId: number;
    workspaceId: number;
    scope?: ("read" | "write")[];
    now?: Date;
  },
) {
  const { id } = await start(tx, args.clientId, {}, args.now);
  const code = await consent(
    tx,
    id,
    args.userId,
    args.workspaceId,
    args.scope,
    args.now,
  );
  return exchangeCode({
    input: {
      clientId: args.clientId,
      code,
      codeVerifier: VERIFIER,
      redirectUri: REDIRECT,
    },
    db: tx,
    now: args.now,
  });
}

async function grantIdOf(tx: DB, accessToken: string): Promise<number> {
  const verified = await verifyAccessToken(accessToken, { db: tx });
  if (!verified) throw new Error("token did not verify");
  return verified.grantId;
}

describe("registerClient", () => {
  test("stores a public client with a hex client_id", async () => {
    await withTestTransaction(async (tx) => {
      const client = await register(tx, "Claude");
      expect(client.client_id).toMatch(/^[a-f0-9]{32}$/);
      expect(client.client_name).toBe("Claude");
      expect(client.token_endpoint_auth_method).toBe("none");
      expect(client.grant_types).toEqual([
        "authorization_code",
        "refresh_token",
      ]);
      expect(client.response_types).toEqual(["code"]);
      expect(client.redirect_uris).toEqual([REDIRECT]);
      expect(typeof client.client_id_issued_at).toBe("number");
    });
  });

  test("defaults the name and dedupes redirect URIs", async () => {
    await withTestTransaction(async (tx) => {
      const client = await registerClient({
        input: { redirect_uris: [REDIRECT, REDIRECT] },
        db: tx,
      });
      expect(client.client_name).toBe("MCP Client");
      expect(client.redirect_uris).toEqual([REDIRECT]);
    });
  });

  test("rejects redirect URIs outside the allowlist", async () => {
    await withTestTransaction(async (tx) => {
      await expect(
        registerClient({
          input: { redirect_uris: [REDIRECT, "https://evil.example/cb"] },
          db: tx,
        }),
      ).rejects.toMatchObject({ oauthCode: "invalid_redirect_uri" });
    });
  });

  test("rejects confidential client metadata", async () => {
    await withTestTransaction(async (tx) => {
      await expect(
        registerClient({
          input: {
            redirect_uris: [REDIRECT],
            // Off-enum on purpose: the wire is untyped.
            token_endpoint_auth_method: "client_secret_post" as never,
          },
          db: tx,
        }),
      ).rejects.toMatchObject({ oauthCode: "invalid_client_metadata" });
    });
  });
});

describe("createSession", () => {
  test("persists the request and defaults scope to write", async () => {
    await withTestTransaction(async (tx) => {
      const client = await register(tx);
      const { id } = await start(tx, client.client_id, { scope: undefined });
      const row = await tx
        .select()
        .from(oauthSession)
        .where(eq(oauthSession.id, id))
        .get();
      expect(row?.scope).toEqual(["write"]);
      expect(row?.state).toBe("state-123");
      expect(row?.codeChallengeMethod).toBe("S256");
      expect(row?.decidedAt).toBeNull();
    });
  });

  test("unknown client and mismatched redirect_uri fail without a redirect", async () => {
    await withTestTransaction(async (tx) => {
      const client = await register(tx);
      const unknown = await start(tx, "does-not-exist").catch((e) => e);
      expect(unknown).toBeInstanceOf(OAuthError);
      expect(unknown.oauthCode).toBe("invalid_client");
      expect(unknown.redirectUri).toBeUndefined();

      const mismatch = await start(tx, client.client_id, {
        redirect_uri: "http://localhost:8765/other",
      }).catch((e) => e);
      expect(mismatch.oauthCode).toBe("invalid_redirect_uri");
      expect(mismatch.redirectUri).toBeUndefined();
    });
  });

  test("later validation failures carry the redirect target and state", async () => {
    await withTestTransaction(async (tx) => {
      const client = await register(tx);
      const cases: [Record<string, string | undefined>, string][] = [
        [{ response_type: "token" }, "unsupported_response_type"],
        [{ code_challenge: undefined }, "invalid_request"],
        [{ code_challenge_method: "plain" }, "invalid_request"],
        [{ scope: "read admin" }, "invalid_scope"],
        [
          {
            resource: "https://elsewhere/mcp",
            expectedResource: "http://localhost:3000/mcp",
          },
          "invalid_target",
        ],
      ];
      for (const [overrides, code] of cases) {
        const err = await start(tx, client.client_id, overrides).catch(
          (e) => e,
        );
        expect(err).toBeInstanceOf(OAuthError);
        expect(err.oauthCode).toBe(code);
        expect(err.redirectUri).toBe(REDIRECT);
        expect(err.state).toBe("state-123");
      }
    });
  });

  test("accepts a matching resource parameter", async () => {
    await withTestTransaction(async (tx) => {
      const client = await register(tx);
      const { id } = await start(tx, client.client_id, {
        resource: "http://localhost:3000/mcp",
        expectedResource: "http://localhost:3000/mcp",
      });
      expect(id).toMatch(/^[A-Za-z0-9_-]{43}$/);
    });
  });
});

describe("getSession", () => {
  test("returns client name and requested scope while pending", async () => {
    await withTestTransaction(async (tx) => {
      const client = await register(tx, "Cursor");
      const { id } = await start(tx, client.client_id, { scope: "read" });
      const pending = await getSession({ input: { id }, db: tx });
      expect(pending.clientName).toBe("Cursor");
      expect(pending.scope).toEqual(["read"]);
    });
  });

  test("throws NotFound for unknown ids", async () => {
    await withTestTransaction(async (tx) => {
      await expect(
        getSession({ input: { id: "nope" }, db: tx }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  test("throws once expired or decided", async () => {
    await withTestTransaction(async (tx) => {
      const client = await register(tx);
      const expired = await start(
        tx,
        client.client_id,
        {},
        new Date(Date.now() - 60 * MINUTE),
      );
      await expect(
        getSession({ input: { id: expired.id }, db: tx }),
      ).rejects.toBeInstanceOf(PreconditionFailedError);

      const decided = await start(tx, client.client_id);
      await decideSession({
        input: { id: decided.id, approved: false, userId: ownerId },
        db: tx,
      });
      await expect(
        getSession({ input: { id: decided.id }, db: tx }),
      ).rejects.toBeInstanceOf(PreconditionFailedError);
    });
  });
});

describe("decideSession", () => {
  test("deny redirects with access_denied and the state", async () => {
    await withTestTransaction(async (tx) => {
      const client = await register(tx);
      const { id } = await start(tx, client.client_id);
      const { redirectUrl } = await decideSession({
        input: { id, approved: false, userId: ownerId },
        db: tx,
      });
      const url = new URL(redirectUrl);
      expect(url.origin + url.pathname).toBe(REDIRECT);
      expect(url.searchParams.get("error")).toBe("access_denied");
      expect(url.searchParams.get("state")).toBe("state-123");
      expect(url.searchParams.get("code")).toBeNull();
    });
  });

  test("an empty state is echoed back, a missing one is omitted", async () => {
    await withTestTransaction(async (tx) => {
      const client = await register(tx);
      const empty = await start(tx, client.client_id, { state: "" });
      const emptyUrl = new URL(
        (
          await decideSession({
            input: { id: empty.id, approved: false, userId: ownerId },
            db: tx,
          })
        ).redirectUrl,
      );
      expect(emptyUrl.searchParams.has("state")).toBe(true);
      expect(emptyUrl.searchParams.get("state")).toBe("");

      const none = await start(tx, client.client_id, { state: undefined });
      const noneUrl = new URL(
        (
          await decideSession({
            input: { id: none.id, approved: false, userId: ownerId },
            db: tx,
          })
        ).redirectUrl,
      );
      expect(noneUrl.searchParams.has("state")).toBe(false);
    });
  });

  test("an oversized state is rejected through the redirect, not a 400", async () => {
    await withTestTransaction(async (tx) => {
      const client = await register(tx);
      const err = await start(tx, client.client_id, {
        state: "x".repeat(1025),
      }).catch((e) => e);
      expect(err).toBeInstanceOf(OAuthError);
      expect(err.oauthCode).toBe("invalid_request");
      expect(err.redirectUri).toBe(REDIRECT);
      expect(err.state?.length).toBe(1024);
    });
  });

  test("approve mints a single-use code bound to the session", async () => {
    await withTestTransaction(async (tx) => {
      const client = await register(tx);
      const { id } = await start(tx, client.client_id);
      const code = await consent(tx, id, ownerId, team.id);
      expect(code).toMatch(/^[A-Za-z0-9_-]{43}$/);
      const rows = await tx
        .select()
        .from(oauthAuthorizationCode)
        .where(eq(oauthAuthorizationCode.clientId, client.client_id))
        .all();
      expect(rows.length).toBe(1);
      expect(rows[0].workspaceId).toBe(team.id);
      expect(rows[0].userId).toBe(ownerId);
      expect(rows[0].scope).toEqual(["write"]);
      expect(rows[0].consumedAt).toBeNull();
    });
  });

  test("rejects a workspace the user is not a member of", async () => {
    await withTestTransaction(async (tx) => {
      const client = await register(tx);
      const { id } = await start(tx, client.client_id);
      await expect(
        decideSession({
          input: { id, approved: true, userId: ownerId, workspaceId: other.id },
          db: tx,
        }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });
  });

  test("requires a workspace to approve", async () => {
    await withTestTransaction(async (tx) => {
      const client = await register(tx);
      const { id } = await start(tx, client.client_id);
      await expect(
        decideSession({
          input: { id, approved: true, userId: ownerId },
          db: tx,
        }),
      ).rejects.toBeInstanceOf(ValidationError);
    });
  });

  test("allows narrowing to read but never widening to write", async () => {
    await withTestTransaction(async (tx) => {
      const client = await register(tx);
      const narrow = await start(tx, client.client_id, { scope: "read write" });
      const code = await consent(tx, narrow.id, ownerId, team.id, ["read"]);
      const tokens = await exchangeCode({
        input: {
          clientId: client.client_id,
          code,
          codeVerifier: VERIFIER,
          redirectUri: REDIRECT,
        },
        db: tx,
      });
      expect(tokens.scope).toBe("read");
      const verified = await verifyAccessToken(tokens.access_token, { db: tx });
      expect(verified?.scopes).toEqual(["read"]);

      const widen = await start(tx, client.client_id, { scope: "read" });
      await expect(
        decideSession({
          input: {
            id: widen.id,
            approved: true,
            userId: ownerId,
            workspaceId: team.id,
            scope: ["write"],
          },
          db: tx,
        }),
      ).rejects.toBeInstanceOf(ValidationError);
    });
  });

  test("a session can only be decided once", async () => {
    await withTestTransaction(async (tx) => {
      const client = await register(tx);
      const { id } = await start(tx, client.client_id);
      await consent(tx, id, ownerId, team.id);
      await expect(
        decideSession({
          input: { id, approved: true, userId: ownerId, workspaceId: team.id },
          db: tx,
        }),
      ).rejects.toBeInstanceOf(PreconditionFailedError);
    });
  });

  test("an expired session cannot be approved", async () => {
    await withTestTransaction(async (tx) => {
      const client = await register(tx);
      const { id } = await start(
        tx,
        client.client_id,
        {},
        new Date(Date.now() - 60 * MINUTE),
      );
      await expect(
        decideSession({
          input: { id, approved: true, userId: ownerId, workspaceId: team.id },
          db: tx,
        }),
      ).rejects.toBeInstanceOf(PreconditionFailedError);
    });
  });
});

describe("exchangeCode", () => {
  test("returns a bearer pair, stores hashes only and emits oauth_grant.create", async () => {
    await withTestTransaction(async (tx) => {
      const client = await register(tx, "Claude");
      const tokens = await mintGrant(tx, {
        clientId: client.client_id,
        userId: ownerId,
        workspaceId: team.id,
      });
      expect(tokens.token_type).toBe("bearer");
      expect(tokens.expires_in).toBe(3600);
      expect(tokens.access_token).toMatch(/^os_oat_[A-Za-z0-9_-]{43}$/);
      expect(tokens.refresh_token).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(tokens.scope).toBe("write");

      const grantId = await grantIdOf(tx, tokens.access_token);
      const row = await tx
        .select()
        .from(oauthGrant)
        .where(eq(oauthGrant.id, grantId))
        .get();
      expect(row?.accessTokenHash).not.toContain(tokens.access_token);
      expect(row?.refreshTokenHash).not.toBe(tokens.refresh_token);
      expect(row?.workspaceId).toBe(team.id);
      expect(row?.userId).toBe(ownerId);

      await expectAuditRow({
        workspaceId: team.id,
        action: "oauth_grant.create",
        entityType: "oauth_grant",
        entityId: grantId,
        actorType: "user",
        db: tx,
      });
      const [audit] = await readAuditLog({
        workspaceId: team.id,
        entityType: "oauth_grant",
        entityId: grantId,
        db: tx,
      });
      expect(audit.metadata).toMatchObject({
        clientName: "Claude",
        scope: ["write"],
      });
      expect(audit.actorUserId).toBe(ownerId);
      expect(JSON.stringify(audit.after)).not.toContain("Hash");
    });
  });

  test("rejects a wrong PKCE verifier and leaves the code unconsumed", async () => {
    await withTestTransaction(async (tx) => {
      const client = await register(tx);
      const { id } = await start(tx, client.client_id);
      const code = await consent(tx, id, ownerId, team.id);
      await expect(
        exchangeCode({
          input: {
            clientId: client.client_id,
            code,
            codeVerifier: `${VERIFIER.slice(0, -1)}A`,
            redirectUri: REDIRECT,
          },
          db: tx,
        }),
      ).rejects.toMatchObject({ oauthCode: "invalid_grant" });
      const row = await tx
        .select()
        .from(oauthAuthorizationCode)
        .where(eq(oauthAuthorizationCode.clientId, client.client_id))
        .get();
      expect(row?.consumedAt).toBeNull();
    });
  });

  test("rejects a mismatched redirect_uri, client and unknown code", async () => {
    await withTestTransaction(async (tx) => {
      const client = await register(tx);
      const otherClient = await register(tx, "Other");
      const { id } = await start(tx, client.client_id);
      const code = await consent(tx, id, ownerId, team.id);
      await expect(
        exchangeCode({
          input: {
            clientId: client.client_id,
            code,
            codeVerifier: VERIFIER,
            redirectUri: "http://localhost:8765/nope",
          },
          db: tx,
        }),
      ).rejects.toMatchObject({ oauthCode: "invalid_grant" });
      await expect(
        exchangeCode({
          input: {
            clientId: otherClient.client_id,
            code,
            codeVerifier: VERIFIER,
            redirectUri: REDIRECT,
          },
          db: tx,
        }),
      ).rejects.toMatchObject({ oauthCode: "invalid_grant" });
      await expect(
        exchangeCode({
          input: {
            clientId: client.client_id,
            code: "bogus",
            codeVerifier: VERIFIER,
            redirectUri: REDIRECT,
          },
          db: tx,
        }),
      ).rejects.toMatchObject({ oauthCode: "invalid_grant" });
      await expect(
        exchangeCode({
          input: {
            clientId: "missing",
            code,
            codeVerifier: VERIFIER,
            redirectUri: REDIRECT,
          },
          db: tx,
        }),
      ).rejects.toMatchObject({ oauthCode: "invalid_client" });
    });
  });

  test("rejects an expired code", async () => {
    await withTestTransaction(async (tx) => {
      const client = await register(tx);
      const { id } = await start(tx, client.client_id);
      const code = await consent(tx, id, ownerId, team.id);
      await expect(
        exchangeCode({
          input: {
            clientId: client.client_id,
            code,
            codeVerifier: VERIFIER,
            redirectUri: REDIRECT,
          },
          db: tx,
          now: new Date(Date.now() + 20 * MINUTE),
        }),
      ).rejects.toMatchObject({ oauthCode: "invalid_grant" });
    });
  });

  test("replaying a consumed code revokes the grant it produced", async () => {
    await withTestTransaction(async (tx) => {
      const client = await register(tx);
      const { id } = await start(tx, client.client_id);
      const code = await consent(tx, id, ownerId, team.id);
      const input = {
        clientId: client.client_id,
        code,
        codeVerifier: VERIFIER,
        redirectUri: REDIRECT,
      };
      const tokens = await exchangeCode({ input, db: tx });
      const grantId = await grantIdOf(tx, tokens.access_token);

      await expect(exchangeCode({ input, db: tx })).rejects.toMatchObject({
        oauthCode: "invalid_grant",
      });
      expect(
        await verifyAccessToken(tokens.access_token, { db: tx }),
      ).toBeNull();
      await expectAuditRow({
        workspaceId: team.id,
        action: "oauth_grant.delete",
        entityType: "oauth_grant",
        entityId: grantId,
        db: tx,
      });
      const rows = await readAuditLog({
        workspaceId: team.id,
        entityType: "oauth_grant",
        entityId: grantId,
        db: tx,
      });
      expect(
        rows.find((r) => r.action === "oauth_grant.delete")?.metadata,
      ).toMatchObject({ reason: "code_reuse" });
    });
  });

  test("re-consent revokes the user's previous grant for the same client, even in another workspace", async () => {
    await withTestTransaction(async (tx) => {
      const client = await register(tx);
      const memberId = (await createUser({}, tx as never)).id;
      await addUserToWorkspace(memberId, team.id, "member", tx as never);
      await addUserToWorkspace(memberId, other.id, "member", tx as never);

      const first = await mintGrant(tx, {
        clientId: client.client_id,
        userId: memberId,
        workspaceId: team.id,
      });
      const firstId = await grantIdOf(tx, first.access_token);
      const second = await mintGrant(tx, {
        clientId: client.client_id,
        userId: memberId,
        workspaceId: other.id,
      });

      expect(
        await verifyAccessToken(first.access_token, { db: tx }),
      ).toBeNull();
      expect(
        (await verifyAccessToken(second.access_token, { db: tx }))?.workspaceId,
      ).toBe(other.id);
      const rows = await readAuditLog({
        workspaceId: team.id,
        entityType: "oauth_grant",
        entityId: firstId,
        db: tx,
      });
      expect(
        rows.find((r) => r.action === "oauth_grant.delete")?.metadata,
      ).toMatchObject({ reason: "re_consent" });
    });
  });

  test("a code minted before the member was removed no longer exchanges", async () => {
    await withTestTransaction(async (tx) => {
      const client = await register(tx);
      const memberId = (await createUser({}, tx as never)).id;
      await addUserToWorkspace(memberId, team.id, "member", tx as never);
      const { id } = await start(tx, client.client_id);
      const code = await consent(tx, id, memberId, team.id);

      await removeMemberInWorkspace({
        tx,
        ctx: { ...makeUserCtx(team, { userId: ownerId }), db: tx },
        userId: memberId,
      });

      await expect(
        exchangeCode({
          input: {
            clientId: client.client_id,
            code,
            codeVerifier: VERIFIER,
            redirectUri: REDIRECT,
          },
          db: tx,
        }),
      ).rejects.toMatchObject({ oauthCode: "invalid_grant" });
      const grants = await tx
        .select()
        .from(oauthGrant)
        .where(eq(oauthGrant.clientId, client.client_id))
        .all();
      expect(grants.length).toBe(0);
    });
  });

  test("a code minted before the account was deleted no longer exchanges", async () => {
    await withTestTransaction(async (tx) => {
      const client = await register(tx);
      const { id } = await start(tx, client.client_id);
      const code = await consent(tx, id, ownerId, team.id);
      await tx
        .update(user)
        .set({ deletedAt: new Date() })
        .where(eq(user.id, ownerId));
      await expect(
        exchangeCode({
          input: {
            clientId: client.client_id,
            code,
            codeVerifier: VERIFIER,
            redirectUri: REDIRECT,
          },
          db: tx,
        }),
      ).rejects.toMatchObject({ oauthCode: "invalid_grant" });
    });
  });

  test("grants for different clients coexist", async () => {
    await withTestTransaction(async (tx) => {
      const a = await register(tx, "A");
      const b = await register(tx, "B");
      const ta = await mintGrant(tx, {
        clientId: a.client_id,
        userId: ownerId,
        workspaceId: team.id,
      });
      const tb = await mintGrant(tx, {
        clientId: b.client_id,
        userId: ownerId,
        workspaceId: team.id,
      });
      expect(
        await verifyAccessToken(ta.access_token, { db: tx }),
      ).not.toBeNull();
      expect(
        await verifyAccessToken(tb.access_token, { db: tx }),
      ).not.toBeNull();
    });
  });
});

describe("verifyAccessToken", () => {
  test("resolves workspace, user and scopes and bumps last_used_at", async () => {
    await withTestTransaction(async (tx) => {
      const client = await register(tx);
      const tokens = await mintGrant(tx, {
        clientId: client.client_id,
        userId: ownerId,
        workspaceId: team.id,
      });
      const verified = await verifyAccessToken(tokens.access_token, { db: tx });
      expect(verified).toMatchObject({
        workspaceId: team.id,
        userId: ownerId,
        scopes: ["write"],
      });
      const row = await tx
        .select()
        .from(oauthGrant)
        .where(eq(oauthGrant.id, verified?.grantId ?? -1))
        .get();
      expect(row?.lastUsedAt).not.toBeNull();
    });
  });

  test("returns null for foreign strings, unknown, expired and revoked tokens", async () => {
    await withTestTransaction(async (tx) => {
      expect(
        await verifyAccessToken("os_0123456789abcdef", { db: tx }),
      ).toBeNull();
      expect(await verifyAccessToken("os_oat_unknown", { db: tx })).toBeNull();

      const client = await register(tx);
      const tokens = await mintGrant(tx, {
        clientId: client.client_id,
        userId: ownerId,
        workspaceId: team.id,
      });
      expect(
        await verifyAccessToken(tokens.access_token, {
          db: tx,
          now: new Date(Date.now() + 2 * 60 * MINUTE),
        }),
      ).toBeNull();

      const grantId = await grantIdOf(tx, tokens.access_token);
      await revokeGrant({
        ctx: { ...makeUserCtx(team, { userId: ownerId }), db: tx },
        input: { grantId },
      });
      expect(
        await verifyAccessToken(tokens.access_token, { db: tx }),
      ).toBeNull();
    });
  });
});

describe("refreshGrant", () => {
  test("rotates both tokens in place and invalidates the old access token", async () => {
    await withTestTransaction(async (tx) => {
      const client = await register(tx);
      const first = await mintGrant(tx, {
        clientId: client.client_id,
        userId: ownerId,
        workspaceId: team.id,
      });
      const grantId = await grantIdOf(tx, first.access_token);
      const second = await refreshGrant({
        input: {
          clientId: client.client_id,
          refreshToken: first.refresh_token,
        },
        db: tx,
      });
      expect(second.access_token).not.toBe(first.access_token);
      expect(second.refresh_token).not.toBe(first.refresh_token);
      expect(second.scope).toBe("write");
      expect(
        await verifyAccessToken(first.access_token, { db: tx }),
      ).toBeNull();
      expect(
        (await verifyAccessToken(second.access_token, { db: tx }))?.grantId,
      ).toBe(grantId);
      const count = await tx
        .select()
        .from(oauthGrant)
        .where(eq(oauthGrant.clientId, client.client_id))
        .all();
      expect(count.length).toBe(1);
    });
  });

  test("extends the refresh expiry on rotation", async () => {
    await withTestTransaction(async (tx) => {
      const client = await register(tx);
      const t0 = new Date();
      const first = await mintGrant(tx, {
        clientId: client.client_id,
        userId: ownerId,
        workspaceId: team.id,
        now: t0,
      });
      const later = new Date(t0.getTime() + 10 * 24 * 60 * MINUTE);
      await refreshGrant({
        input: {
          clientId: client.client_id,
          refreshToken: first.refresh_token,
        },
        db: tx,
        now: later,
      });
      const row = await tx
        .select()
        .from(oauthGrant)
        .where(eq(oauthGrant.clientId, client.client_id))
        .get();
      expect(row?.refreshTokenExpiresAt.getTime() ?? 0).toBeGreaterThan(
        later.getTime() + 89 * 24 * 60 * MINUTE,
      );
    });
  });

  test("the rotated-out token is accepted inside the grace window and rotates again", async () => {
    await withTestTransaction(async (tx) => {
      const client = await register(tx);
      const t0 = new Date();
      const r0 = await mintGrant(tx, {
        clientId: client.client_id,
        userId: ownerId,
        workspaceId: team.id,
        now: t0,
      });
      const r1 = await refreshGrant({
        input: { clientId: client.client_id, refreshToken: r0.refresh_token },
        db: tx,
        now: t0,
      });
      const r2 = await refreshGrant({
        input: { clientId: client.client_id, refreshToken: r0.refresh_token },
        db: tx,
        now: new Date(t0.getTime() + 10_000),
      });
      expect(r2.refresh_token).not.toBe(r1.refresh_token);
      expect(
        await verifyAccessToken(r2.access_token, { db: tx }),
      ).not.toBeNull();
      // r1 is now the rotated-out token: still inside its own window.
      const r3 = await refreshGrant({
        input: { clientId: client.client_id, refreshToken: r1.refresh_token },
        db: tx,
        now: new Date(t0.getTime() + 20_000),
      });
      expect(
        await verifyAccessToken(r3.access_token, { db: tx }),
      ).not.toBeNull();
    });
  });

  test("reuse after the grace window revokes the whole grant", async () => {
    await withTestTransaction(async (tx) => {
      const client = await register(tx);
      const t0 = new Date();
      const r0 = await mintGrant(tx, {
        clientId: client.client_id,
        userId: ownerId,
        workspaceId: team.id,
        now: t0,
      });
      const grantId = await grantIdOf(tx, r0.access_token);
      const r1 = await refreshGrant({
        input: { clientId: client.client_id, refreshToken: r0.refresh_token },
        db: tx,
        now: t0,
      });
      await expect(
        refreshGrant({
          input: { clientId: client.client_id, refreshToken: r0.refresh_token },
          db: tx,
          now: new Date(t0.getTime() + 31_000),
        }),
      ).rejects.toMatchObject({ oauthCode: "invalid_grant" });
      expect(await verifyAccessToken(r1.access_token, { db: tx })).toBeNull();
      await expect(
        refreshGrant({
          input: { clientId: client.client_id, refreshToken: r1.refresh_token },
          db: tx,
        }),
      ).rejects.toMatchObject({ oauthCode: "invalid_grant" });
      const rows = await readAuditLog({
        workspaceId: team.id,
        entityType: "oauth_grant",
        entityId: grantId,
        db: tx,
      });
      expect(
        rows.find((r) => r.action === "oauth_grant.delete")?.metadata,
      ).toMatchObject({ reason: "refresh_reuse" });
    });
  });

  test("rejects unknown tokens, another client's token and revoked grants", async () => {
    await withTestTransaction(async (tx) => {
      const client = await register(tx);
      const otherClient = await register(tx, "Other");
      const tokens = await mintGrant(tx, {
        clientId: client.client_id,
        userId: ownerId,
        workspaceId: team.id,
      });
      await expect(
        refreshGrant({
          input: { clientId: client.client_id, refreshToken: "nope" },
          db: tx,
        }),
      ).rejects.toMatchObject({ oauthCode: "invalid_grant" });
      await expect(
        refreshGrant({
          input: {
            clientId: otherClient.client_id,
            refreshToken: tokens.refresh_token,
          },
          db: tx,
        }),
      ).rejects.toMatchObject({ oauthCode: "invalid_grant" });
      const grantId = await grantIdOf(tx, tokens.access_token);
      await revokeGrant({
        ctx: { ...makeUserCtx(team, { userId: ownerId }), db: tx },
        input: { grantId },
      });
      await expect(
        refreshGrant({
          input: {
            clientId: client.client_id,
            refreshToken: tokens.refresh_token,
          },
          db: tx,
        }),
      ).rejects.toMatchObject({ oauthCode: "invalid_grant" });
    });
  });

  test("rejects an expired refresh token", async () => {
    await withTestTransaction(async (tx) => {
      const client = await register(tx);
      const tokens = await mintGrant(tx, {
        clientId: client.client_id,
        userId: ownerId,
        workspaceId: team.id,
      });
      await expect(
        refreshGrant({
          input: {
            clientId: client.client_id,
            refreshToken: tokens.refresh_token,
          },
          db: tx,
          now: new Date(Date.now() + 91 * 24 * 60 * MINUTE),
        }),
      ).rejects.toMatchObject({ oauthCode: "invalid_grant" });
      expect(
        await verifyAccessToken(tokens.access_token, { db: tx }),
      ).toBeNull();
    });
  });
});

describe("listGrants / revokeGrant", () => {
  test("lists live grants with client and user, hiding revoked ones", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...makeUserCtx(team, { userId: ownerId }), db: tx };
      const client = await register(tx, "Claude Desktop");
      const tokens = await mintGrant(tx, {
        clientId: client.client_id,
        userId: ownerId,
        workspaceId: team.id,
        scope: ["read"],
      });
      const grantId = await grantIdOf(tx, tokens.access_token);

      const before = await listGrants({ ctx });
      const found = before.find((g) => g.id === grantId);
      expect(found).toMatchObject({
        clientName: "Claude Desktop",
        scope: ["read"],
        userId: ownerId,
      });
      expect(found?.user?.id).toBe(ownerId);
      expect(Object.keys(found ?? {})).not.toContain("accessTokenHash");

      await revokeGrant({ ctx, input: { grantId } });
      const after = await listGrants({ ctx });
      expect(after.find((g) => g.id === grantId)).toBeUndefined();
      await expectAuditRow({
        workspaceId: team.id,
        action: "oauth_grant.delete",
        entityType: "oauth_grant",
        entityId: grantId,
        actorType: "user",
        db: tx,
      });
    });
  });

  test("does not list another workspace's grants", async () => {
    await withTestTransaction(async (tx) => {
      const client = await register(tx);
      const tokens = await mintGrant(tx, {
        clientId: client.client_id,
        userId: ownerId,
        workspaceId: team.id,
      });
      const grantId = await grantIdOf(tx, tokens.access_token);
      const otherCtx = { ...makeUserCtx(other, { userId: ownerId }), db: tx };
      expect(
        (await listGrants({ ctx: otherCtx })).find((g) => g.id === grantId),
      ).toBeUndefined();
      await expect(
        revokeGrant({ ctx: otherCtx, input: { grantId } }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  test("members revoke their own grants but not others'; admins and owners revoke any", async () => {
    await withTestTransaction(async (tx) => {
      const client = await register(tx);
      const memberId = (await createUser({}, tx as never)).id;
      const adminId = (await createUser({}, tx as never)).id;
      await addUserToWorkspace(memberId, team.id, "member", tx as never);
      await addUserToWorkspace(adminId, team.id, "member", tx as never);
      await tx
        .update(usersToWorkspaces)
        .set({ role: "admin" })
        .where(
          and(
            eq(usersToWorkspaces.userId, adminId),
            eq(usersToWorkspaces.workspaceId, team.id),
          ),
        );

      const own = await mintGrant(tx, {
        clientId: client.client_id,
        userId: memberId,
        workspaceId: team.id,
      });
      const ownersGrant = await mintGrant(tx, {
        clientId: (await register(tx, "B")).client_id,
        userId: ownerId,
        workspaceId: team.id,
      });
      const ownId = await grantIdOf(tx, own.access_token);
      const ownersId = await grantIdOf(tx, ownersGrant.access_token);

      const memberCtx = { ...makeUserCtx(team, { userId: memberId }), db: tx };
      await expect(
        revokeGrant({ ctx: memberCtx, input: { grantId: ownersId } }),
      ).rejects.toBeInstanceOf(ForbiddenError);
      await revokeGrant({ ctx: memberCtx, input: { grantId: ownId } });
      expect(await verifyAccessToken(own.access_token, { db: tx })).toBeNull();

      const adminCtx = { ...makeUserCtx(team, { userId: adminId }), db: tx };
      await revokeGrant({ ctx: adminCtx, input: { grantId: ownersId } });
      expect(
        await verifyAccessToken(ownersGrant.access_token, { db: tx }),
      ).toBeNull();
    });
  });

  test("revoking twice reports not found", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...makeUserCtx(team, { userId: ownerId }), db: tx };
      const client = await register(tx);
      const tokens = await mintGrant(tx, {
        clientId: client.client_id,
        userId: ownerId,
        workspaceId: team.id,
      });
      const grantId = await grantIdOf(tx, tokens.access_token);
      await revokeGrant({ ctx, input: { grantId } });
      await expect(
        revokeGrant({ ctx, input: { grantId } }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  test("rejects read-only actor", async () => {
    await withTestTransaction(async (tx) => {
      const readOnlyCtx: ServiceContext = {
        ...makeApiKeyCtx(team, {
          keyId: "k-read",
          userId: ownerId,
          scopes: ["read"],
        }),
        db: tx,
      };
      await expect(
        revokeGrant({ ctx: readOnlyCtx, input: { grantId: 1 } }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });
  });
});

describe("revokeToken (RFC 7009)", () => {
  test("either token revokes the grant; unknown tokens are a no-op", async () => {
    await withTestTransaction(async (tx) => {
      const client = await register(tx);
      const a = await mintGrant(tx, {
        clientId: client.client_id,
        userId: ownerId,
        workspaceId: team.id,
      });
      await revokeToken({
        input: { clientId: client.client_id, token: a.access_token },
        db: tx,
      });
      expect(await verifyAccessToken(a.access_token, { db: tx })).toBeNull();

      const b = await mintGrant(tx, {
        clientId: client.client_id,
        userId: ownerId,
        workspaceId: team.id,
      });
      await revokeToken({
        input: { clientId: client.client_id, token: b.refresh_token },
        db: tx,
      });
      expect(await verifyAccessToken(b.access_token, { db: tx })).toBeNull();

      await revokeToken({
        input: { clientId: client.client_id, token: "unknown" },
        db: tx,
      });
    });
  });

  test("another client cannot revoke the grant", async () => {
    await withTestTransaction(async (tx) => {
      const client = await register(tx);
      const otherClient = await register(tx, "Other");
      const a = await mintGrant(tx, {
        clientId: client.client_id,
        userId: ownerId,
        workspaceId: team.id,
      });
      await revokeToken({
        input: { clientId: otherClient.client_id, token: a.access_token },
        db: tx,
      });
      expect(
        await verifyAccessToken(a.access_token, { db: tx }),
      ).not.toBeNull();
    });
  });
});

describe("revokeGrantRows", () => {
  test("an already revoked grant is skipped and not audited twice", async () => {
    await withTestTransaction(async (tx) => {
      const client = await register(tx);
      const tokens = await mintGrant(tx, {
        clientId: client.client_id,
        userId: ownerId,
        workspaceId: team.id,
      });
      const grantId = await grantIdOf(tx, tokens.access_token);
      const ctx = { ...makeUserCtx(team, { userId: ownerId }), db: tx };
      const stale = await tx
        .select()
        .from(oauthGrant)
        .where(eq(oauthGrant.id, grantId))
        .get();
      if (!stale) throw new Error("grant missing");
      expect(await revokeGrantRows(tx, ctx, [stale], "manual")).toBe(1);
      // Same pre-revocation snapshot presented again, as a racing caller would.
      expect(await revokeGrantRows(tx, ctx, [stale], "manual")).toBe(0);
      const rows = await readAuditLog({
        workspaceId: team.id,
        entityType: "oauth_grant",
        entityId: grantId,
        db: tx,
      });
      expect(rows.filter((r) => r.action === "oauth_grant.delete").length).toBe(
        1,
      );
    });
  });
});

describe("lifecycle hooks", () => {
  test("removing a member revokes their grants in that workspace only", async () => {
    await withTestTransaction(async (tx) => {
      const client = await register(tx);
      const memberId = (await createUser({}, tx as never)).id;
      await addUserToWorkspace(memberId, team.id, "member", tx as never);
      await addUserToWorkspace(memberId, other.id, "member", tx as never);
      const inTeam = await mintGrant(tx, {
        clientId: client.client_id,
        userId: memberId,
        workspaceId: team.id,
      });
      const inOther = await mintGrant(tx, {
        clientId: (await register(tx, "B")).client_id,
        userId: memberId,
        workspaceId: other.id,
      });
      const teamGrantId = await grantIdOf(tx, inTeam.access_token);

      const ctx = { ...makeUserCtx(team, { userId: ownerId }), db: tx };
      await removeMemberInWorkspace({ tx, ctx, userId: memberId });

      expect(
        await verifyAccessToken(inTeam.access_token, { db: tx }),
      ).toBeNull();
      expect(
        await verifyAccessToken(inOther.access_token, { db: tx }),
      ).not.toBeNull();
      const rows = await readAuditLog({
        workspaceId: team.id,
        entityType: "oauth_grant",
        entityId: teamGrantId,
        db: tx,
      });
      const del = rows.find((r) => r.action === "oauth_grant.delete");
      expect(del?.metadata).toMatchObject({ reason: "member_removed" });
      expect(del?.actorUserId).toBe(ownerId);
    });
  });

  test("revokeGrantsForUser without a workspace revokes everywhere", async () => {
    await withTestTransaction(async (tx) => {
      const memberId = (await createUser({}, tx as never)).id;
      await addUserToWorkspace(memberId, team.id, "member", tx as never);
      await addUserToWorkspace(memberId, other.id, "member", tx as never);
      const a = await mintGrant(tx, {
        clientId: (await register(tx, "A")).client_id,
        userId: memberId,
        workspaceId: team.id,
      });
      const b = await mintGrant(tx, {
        clientId: (await register(tx, "B")).client_id,
        userId: memberId,
        workspaceId: other.id,
      });
      const ctx = { ...makeUserCtx(team, { userId: memberId }), db: tx };
      const revoked = await revokeGrantsForUser({ tx, ctx, userId: memberId });
      expect(revoked).toBe(2);
      expect(await verifyAccessToken(a.access_token, { db: tx })).toBeNull();
      expect(await verifyAccessToken(b.access_token, { db: tx })).toBeNull();
      const otherGrants = await tx
        .select({ id: oauthGrant.id })
        .from(oauthGrant)
        .where(eq(oauthGrant.workspaceId, other.id))
        .all();
      const otherGrantId = otherGrants[otherGrants.length - 1]?.id ?? -1;
      await expectAuditRow({
        workspaceId: other.id,
        action: "oauth_grant.delete",
        entityType: "oauth_grant",
        entityId: otherGrantId,
        db: tx,
      });
    });
  });

  test("account deletion revokes every grant of the user", async () => {
    await withTestTransaction(async (tx) => {
      const memberId = (await createUser({}, tx as never)).id;
      await addUserToWorkspace(memberId, team.id, "member", tx as never);
      await addUserToWorkspace(memberId, other.id, "member", tx as never);
      const a = await mintGrant(tx, {
        clientId: (await register(tx, "A")).client_id,
        userId: memberId,
        workspaceId: team.id,
      });
      const b = await mintGrant(tx, {
        clientId: (await register(tx, "B")).client_id,
        userId: memberId,
        workspaceId: other.id,
      });
      const grantId = await grantIdOf(tx, a.access_token);

      await deleteAccount({
        ctx: { ...makeUserCtx(team, { userId: memberId }), db: tx },
      });

      expect(await verifyAccessToken(a.access_token, { db: tx })).toBeNull();
      expect(await verifyAccessToken(b.access_token, { db: tx })).toBeNull();
      const rows = await readAuditLog({
        workspaceId: team.id,
        entityType: "oauth_grant",
        entityId: grantId,
        db: tx,
      });
      expect(
        rows.find((r) => r.action === "oauth_grant.delete")?.metadata,
      ).toMatchObject({ reason: "account_deleted" });
    });
  });
});

describe("pruneExpired", () => {
  test("drops expired sessions and codes, expires stale grants and orphan clients", async () => {
    await withTestTransaction(async (tx) => {
      const now = new Date();
      const past = new Date(now.getTime() - 60 * MINUTE);
      const live = await register(tx, "Live");
      const orphan = await register(tx, "Orphan");
      const fresh = await register(tx, "Fresh");
      await tx
        .update(oauthClient)
        .set({ createdAt: new Date(now.getTime() - 8 * 24 * 60 * MINUTE) })
        .where(eq(oauthClient.clientId, orphan.client_id));
      await tx
        .update(oauthClient)
        .set({ createdAt: new Date(now.getTime() - 8 * 24 * 60 * MINUTE) })
        .where(eq(oauthClient.clientId, live.client_id));

      // expired session + expired code on the orphan, live session on fresh
      const expiredSession = await start(tx, orphan.client_id, {}, past);
      const liveSession = await start(tx, fresh.client_id);
      const codeSession = await start(tx, live.client_id, {}, past);
      await decideSession({
        input: {
          id: codeSession.id,
          approved: true,
          userId: ownerId,
          workspaceId: team.id,
        },
        db: tx,
        now: past,
      });

      // grant whose refresh token expired keeps the client alive
      const tokens = await mintGrant(tx, {
        clientId: live.client_id,
        userId: ownerId,
        workspaceId: team.id,
        now: new Date(now.getTime() - 100 * 24 * 60 * MINUTE),
      });

      const result = await pruneExpired({ ctx: { db: tx }, now });
      expect(result.sessions).toBeGreaterThanOrEqual(1);
      expect(result.codes).toBeGreaterThanOrEqual(1);
      expect(result.grants).toBeGreaterThanOrEqual(1);
      expect(result.clients).toBeGreaterThanOrEqual(1);

      expect(
        await tx
          .select()
          .from(oauthSession)
          .where(eq(oauthSession.id, expiredSession.id))
          .get(),
      ).toBeUndefined();
      expect(
        await tx
          .select()
          .from(oauthSession)
          .where(eq(oauthSession.id, liveSession.id))
          .get(),
      ).toBeDefined();
      expect(
        await tx
          .select()
          .from(oauthClient)
          .where(eq(oauthClient.clientId, orphan.client_id))
          .get(),
      ).toBeUndefined();
      expect(
        await tx
          .select()
          .from(oauthClient)
          .where(eq(oauthClient.clientId, live.client_id))
          .get(),
      ).toBeDefined();
      expect(
        await tx
          .select()
          .from(oauthClient)
          .where(eq(oauthClient.clientId, fresh.client_id))
          .get(),
      ).toBeDefined();
      expect(
        await verifyAccessToken(tokens.access_token, { db: tx, now }),
      ).toBeNull();
      const grant = await tx
        .select()
        .from(oauthGrant)
        .where(eq(oauthGrant.clientId, live.client_id))
        .get();
      expect(grant?.revokedAt).not.toBeNull();
    });
  });
});
