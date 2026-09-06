import { eq } from "@openstatus/db";
import { oauthClient } from "@openstatus/db/src/schema";
import { expect } from "@std/expect";
import { beforeAll, describe, test } from "@std/testing/bdd";

import {
  createWorkspaceFixture,
  withTestTransaction,
} from "../../../test/helpers";
import type { Workspace } from "../../types";
import {
  type ClientMetadataDocument,
  isUrlClientId,
  parseClientMetadataDocument,
} from "../cimd";
import { pkceChallenge } from "../crypto";
import { OAuthError } from "../errors";
import {
  createSession,
  decideSession,
  exchangeCode,
  getSession,
  verifyAccessToken,
} from "../index";
import { authorizationServerMetadata } from "../metadata";

const CLIENT_ID = "https://partner.example/.well-known/oauth-client";
const REDIRECT = "https://partner.example/oauth/callback";
const VERIFIER = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";

let team: Workspace;
let ownerId: number;

beforeAll(async () => {
  const fixture = await createWorkspaceFixture("team");
  team = fixture.workspace;
  ownerId = fixture.userId;
});

function doc(
  overrides: Partial<ClientMetadataDocument> = {},
): ClientMetadataDocument {
  return {
    client_id: CLIENT_ID,
    client_name: "Partner App",
    redirect_uris: [REDIRECT],
    ...overrides,
  };
}

const stub =
  (document: ClientMetadataDocument | Error) => async (clientId: string) => {
    if (document instanceof Error) throw document;
    return parseClientMetadataDocument(clientId, document);
  };

async function authorizeAs(
  clientId: string,
  fetcher: ReturnType<typeof stub>,
  tx: Parameters<Parameters<typeof withTestTransaction>[0]>[0],
  overrides: Record<string, string> = {},
) {
  return createSession({
    input: {
      response_type: "code",
      client_id: clientId,
      redirect_uri: REDIRECT,
      scope: "read",
      code_challenge: await pkceChallenge(VERIFIER),
      code_challenge_method: "S256",
      ...overrides,
    },
    db: tx,
    fetchClientMetadata: fetcher,
  });
}

describe("isUrlClientId", () => {
  test("accepts public https URLs with a path", () => {
    expect(isUrlClientId(CLIENT_ID)).toBe(true);
    expect(isUrlClientId("https://app.partner.example:8443/client.json")).toBe(
      true,
    );
  });

  test("rejects plain DCR ids, http, root paths, credentials and fragments", () => {
    expect(isUrlClientId("0123456789abcdef0123456789abcdef")).toBe(false);
    expect(isUrlClientId("http://partner.example/client")).toBe(false);
    expect(isUrlClientId("https://partner.example/")).toBe(false);
    expect(isUrlClientId("https://partner.example")).toBe(false);
    expect(isUrlClientId("https://user:pw@partner.example/client")).toBe(false);
    expect(isUrlClientId("https://partner.example/client#x")).toBe(false);
  });

  test("rejects loopback, private and link-local targets", () => {
    for (const host of [
      "localhost",
      "api.localhost",
      "127.0.0.1",
      "10.0.0.5",
      "172.16.3.4",
      "192.168.1.1",
      "169.254.169.254",
      "100.64.0.1",
      "[::1]",
      "[fd00::1]",
      "metadata.google.internal",
      "printer.local",
      "intranet",
    ]) {
      expect(isUrlClientId(`https://${host}/client`)).toBe(false);
    }
    expect(isUrlClientId("https://8.8.8.8/client")).toBe(true);
  });

  test("a trailing dot does not bypass the hostname checks", () => {
    expect(isUrlClientId("https://localhost./client")).toBe(false);
    expect(isUrlClientId("https://intranet./client")).toBe(false);
    expect(isUrlClientId("https://partner.example./client")).toBe(true);
  });

  test("a bare trailing # counts as a fragment", () => {
    expect(isUrlClientId(`${CLIENT_ID}#`)).toBe(false);
  });
});

describe("parseClientMetadataDocument", () => {
  test("accepts a public client document", () => {
    const parsed = parseClientMetadataDocument(
      CLIENT_ID,
      doc({ token_endpoint_auth_method: "none" }),
    );
    expect(parsed.client_name).toBe("Partner App");
  });

  test("rejects a document whose client_id differs from its URL", () => {
    expect(() =>
      parseClientMetadataDocument(
        CLIENT_ID,
        doc({ client_id: "https://other.example/c" }),
      ),
    ).toThrow(OAuthError);
  });

  test("rejects missing or non-https redirect URIs and confidential clients", () => {
    expect(() =>
      parseClientMetadataDocument(CLIENT_ID, doc({ redirect_uris: [] })),
    ).toThrow(OAuthError);
    expect(() =>
      parseClientMetadataDocument(
        CLIENT_ID,
        doc({ redirect_uris: ["http://partner.example/cb"] }),
      ),
    ).toThrow(OAuthError);
    expect(() =>
      parseClientMetadataDocument(
        CLIENT_ID,
        doc({ redirect_uris: ["myapp://cb"] }),
      ),
    ).toThrow(OAuthError);
    expect(() =>
      parseClientMetadataDocument(
        CLIENT_ID,
        doc({ redirect_uris: ["https://user:pw@partner.example/cb"] }),
      ),
    ).toThrow(OAuthError);
    expect(() =>
      parseClientMetadataDocument(
        CLIENT_ID,
        doc({ redirect_uris: ["https://partner.example/cb#x"] }),
      ),
    ).toThrow(OAuthError);
    expect(() =>
      parseClientMetadataDocument(CLIENT_ID, {
        ...doc(),
        token_endpoint_auth_method: "client_secret_basic",
      }),
    ).toThrow(OAuthError);
    expect(() => parseClientMetadataDocument(CLIENT_ID, "nope")).toThrow(
      OAuthError,
    );
  });

  test("allows loopback http redirects for native partners", () => {
    const parsed = parseClientMetadataDocument(
      CLIENT_ID,
      doc({ redirect_uris: ["http://127.0.0.1:9000/cb", REDIRECT] }),
    );
    expect(parsed.redirect_uris.length).toBe(2);
  });
});

describe("authorize with a URL client id", () => {
  test("advertises support in the server metadata", () => {
    expect(
      authorizationServerMetadata("https://api.example")
        .client_id_metadata_document_supported,
    ).toBe(true);
  });

  test("fetches the document, upserts the client and completes the flow", async () => {
    await withTestTransaction(async (tx) => {
      const { id } = await authorizeAs(CLIENT_ID, stub(doc()), tx);
      const row = await tx
        .select()
        .from(oauthClient)
        .where(eq(oauthClient.clientId, CLIENT_ID))
        .get();
      expect(row?.name).toBe("Partner App");
      expect(row?.redirectUris).toEqual([REDIRECT]);

      const pending = await getSession({ input: { id }, db: tx });
      expect(pending.clientId).toBe(CLIENT_ID);

      const { redirectUrl } = await decideSession({
        input: { id, approved: true, userId: ownerId, workspaceId: team.id },
        db: tx,
      });
      const code = new URL(redirectUrl).searchParams.get("code") ?? "";
      const tokens = await exchangeCode({
        input: {
          clientId: CLIENT_ID,
          code,
          codeVerifier: VERIFIER,
          redirectUri: REDIRECT,
        },
        db: tx,
      });
      expect(
        (await verifyAccessToken(tokens.access_token, { db: tx }))?.workspaceId,
      ).toBe(team.id);
    });
  });

  test("re-fetches on every authorize so document changes take effect", async () => {
    await withTestTransaction(async (tx) => {
      await authorizeAs(CLIENT_ID, stub(doc()), tx);
      const renamed = stub(
        doc({
          client_name: "Partner App v2",
          redirect_uris: [REDIRECT, "https://partner.example/cb2"],
        }),
      );
      await authorizeAs(CLIENT_ID, renamed, tx);
      const row = await tx
        .select()
        .from(oauthClient)
        .where(eq(oauthClient.clientId, CLIENT_ID))
        .get();
      expect(row?.name).toBe("Partner App v2");
      expect(row?.redirectUris).toEqual([
        REDIRECT,
        "https://partner.example/cb2",
      ]);
      const count = await tx
        .select()
        .from(oauthClient)
        .where(eq(oauthClient.clientId, CLIENT_ID))
        .all();
      expect(count.length).toBe(1);
    });
  });

  test("falls back to the hostname when the document has no client_name", async () => {
    await withTestTransaction(async (tx) => {
      await authorizeAs(CLIENT_ID, stub(doc({ client_name: undefined })), tx);
      const row = await tx
        .select()
        .from(oauthClient)
        .where(eq(oauthClient.clientId, CLIENT_ID))
        .get();
      expect(row?.name).toBe("partner.example");
    });
  });

  test("a redirect_uri missing from the document is rejected without a redirect", async () => {
    await withTestTransaction(async (tx) => {
      const err = await authorizeAs(CLIENT_ID, stub(doc()), tx, {
        redirect_uri: "https://partner.example/elsewhere",
      }).catch((e) => e);
      expect(err).toBeInstanceOf(OAuthError);
      expect(err.oauthCode).toBe("invalid_redirect_uri");
      expect(err.redirectUri).toBeUndefined();
    });
  });

  test("fetch failures surface as invalid_client", async () => {
    await withTestTransaction(async (tx) => {
      const err = await authorizeAs(
        CLIENT_ID,
        stub(
          new OAuthError(
            "invalid_client",
            "Client metadata document responded with HTTP 404",
          ),
        ),
        tx,
      ).catch((e) => e);
      expect(err.oauthCode).toBe("invalid_client");
      expect(
        await tx
          .select()
          .from(oauthClient)
          .where(eq(oauthClient.clientId, CLIENT_ID))
          .get(),
      ).toBeUndefined();
    });
  });

  test("an operator-revoked URL client stays blocked even with a valid document", async () => {
    await withTestTransaction(async (tx) => {
      await authorizeAs(CLIENT_ID, stub(doc()), tx);
      await tx
        .update(oauthClient)
        .set({ revokedAt: new Date() })
        .where(eq(oauthClient.clientId, CLIENT_ID));
      let fetched = false;
      const err = await authorizeAs(
        CLIENT_ID,
        async (id) => {
          fetched = true;
          return parseClientMetadataDocument(id, doc());
        },
        tx,
      ).catch((e) => e);
      expect(err.oauthCode).toBe("invalid_client");
      expect(fetched).toBe(false);
    });
  });

  test("the stub is never consulted for plain DCR client ids", async () => {
    await withTestTransaction(async (tx) => {
      let fetched = false;
      const err = await authorizeAs(
        "0123456789abcdef0123456789abcdef",
        async (id) => {
          fetched = true;
          return parseClientMetadataDocument(id, doc());
        },
        tx,
      ).catch((e) => e);
      expect(err.oauthCode).toBe("invalid_client");
      expect(fetched).toBe(false);
    });
  });
});
