import { and, eq } from "@openstatus/db";
import {
  usersToWorkspaces,
  workspace,
  workspaceSsoDomain,
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
  makeSystemCtx,
  makeUserCtx,
  readAuditLog,
  withTestTransaction,
} from "../../../test/helpers";
import type { ServiceContext } from "../../context";
import { ForbiddenError, PreconditionFailedError } from "../../errors";
import type { Workspace } from "../../types";
import type { WorkOSClient } from "../client";
import { disableSso } from "../disable";
import { enableSso } from "../enable";
import { joinSsoWorkspace } from "../join";
import {
  getWorkspaceByVerifiedSsoDomain,
  isEmailAllowedForWorkspace,
  normalizeSsoDomain,
} from "../lookup";
import { createSsoPortalLink } from "../portal-link";
import {
  reconcileSsoDomains,
  removeSsoDomain,
  syncSsoDomain,
} from "../sync-domains";

let scaleCtx: ServiceContext;
let freeCtx: ServiceContext;
let unpurchasedScale: { workspace: Workspace; userId: number };
let SCALE_OWNER_ID: number;
let SCALE_MEMBER_ID: number;

function fakeWorkOS(
  overrides: {
    organizationId?: string;
    domains?: { domain: string; state: string }[];
  } = {},
): WorkOSClient {
  const organizationId = overrides.organizationId ?? "org_test_1";
  return {
    organizations: {
      createOrganization: () => Promise.resolve({ id: organizationId }),
      getOrganization: () =>
        Promise.resolve({ domains: overrides.domains ?? [] }),
    },
    adminPortal: {
      generateLink: () =>
        Promise.resolve({ link: "https://portal.workos.test/abc" }),
    },
    sso: {
      listConnections: () =>
        Promise.resolve({ data: [{ state: "active" as const }] }),
      getConnection: () => Promise.resolve({ organizationId }),
    },
  };
}

beforeAll(async () => {
  // SSO is an add-on on every paid plan, not a bundled plan feature — the
  // purchased flag lives as a workspace-level override on top of the plan.
  const scale = await createWorkspaceFixture("scale", {
    limits: JSON.stringify({ sso: true }),
  });
  SCALE_OWNER_ID = scale.userId;
  scaleCtx = makeUserCtx(scale.workspace, { userId: SCALE_OWNER_ID });

  const member = await createUser();
  SCALE_MEMBER_ID = member.id;
  await addUserToWorkspace(SCALE_MEMBER_ID, scale.workspace.id, "member");

  freeCtx = makeUserCtx((await createWorkspaceFixture("free")).workspace, {
    userId: (await createUser()).id,
  });

  unpurchasedScale = await createWorkspaceFixture("scale");
});

/** An owner-linked api key that only holds `read` — every write verb must refuse it. */
function readOnlyCtx(): ServiceContext {
  return makeApiKeyCtx(scaleCtx.workspace, {
    keyId: "k",
    userId: SCALE_OWNER_ID,
    scopes: ["read"],
  });
}

describe("enableSso", () => {
  test("owner enables SSO on scale, org persisted, audit row written", async () => {
    await withTestTransaction(async (tx) => {
      const result = await enableSso({
        ctx: { ...scaleCtx, db: tx, workos: fakeWorkOS() },
      });

      expect(result.organizationId).toBe("org_test_1");

      const row = await tx
        .select()
        .from(workspace)
        .where(eq(workspace.id, scaleCtx.workspace.id))
        .get();
      expect(row?.ssoEnabled).toBe(true);
      expect(row?.workosOrganizationId).toBe("org_test_1");

      await expectAuditRow({
        workspaceId: scaleCtx.workspace.id,
        action: "workspace_sso.create",
        entityType: "workspace_sso",
        entityId: scaleCtx.workspace.id,
        db: tx,
      });
    });
  });

  test("rejects a workspace without the sso add-on", async () => {
    await withTestTransaction(async (tx) => {
      await expect(
        enableSso({ ctx: { ...freeCtx, db: tx, workos: fakeWorkOS() } }),
      ).rejects.toBeInstanceOf(PreconditionFailedError);
    });
  });

  test("rejects a paid plan that has not purchased the add-on", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = makeUserCtx(unpurchasedScale.workspace, {
        userId: unpurchasedScale.userId,
      });
      await expect(
        enableSso({ ctx: { ...ctx, db: tx, workos: fakeWorkOS() } }),
      ).rejects.toBeInstanceOf(PreconditionFailedError);
    });
  });

  test("rejects a non-owner member", async () => {
    await withTestTransaction(async (tx) => {
      const memberCtx = makeUserCtx(scaleCtx.workspace, {
        userId: SCALE_MEMBER_ID,
      });
      await expect(
        enableSso({ ctx: { ...memberCtx, db: tx, workos: fakeWorkOS() } }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });
  });

  test("rejects read-only actor", async () => {
    await withTestTransaction(async (tx) => {
      await expect(
        enableSso({ ctx: { ...readOnlyCtx(), db: tx, workos: fakeWorkOS() } }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });
  });

  test("re-enabling reuses the existing organization", async () => {
    await withTestTransaction(async (tx) => {
      await enableSso({ ctx: { ...scaleCtx, db: tx, workos: fakeWorkOS() } });
      await disableSso({ ctx: { ...scaleCtx, db: tx } });

      const again = await enableSso({
        ctx: {
          ...scaleCtx,
          db: tx,
          workos: fakeWorkOS({ organizationId: "org_should_not_be_used" }),
        },
      });

      expect(again.organizationId).toBe("org_test_1");
    });
  });
});

describe("disableSso", () => {
  test("clears the switch but keeps memberships", async () => {
    await withTestTransaction(async (tx) => {
      await enableSso({ ctx: { ...scaleCtx, db: tx, workos: fakeWorkOS() } });
      await disableSso({ ctx: { ...scaleCtx, db: tx } });

      const row = await tx
        .select()
        .from(workspace)
        .where(eq(workspace.id, scaleCtx.workspace.id))
        .get();
      expect(row?.ssoEnabled).toBe(false);
      // The organization link survives so a re-upgrade keeps the IdP config.
      expect(row?.workosOrganizationId).toBe("org_test_1");

      const members = await tx.query.usersToWorkspaces.findMany({
        where: (t, { eq: equals }) =>
          equals(t.workspaceId, scaleCtx.workspace.id),
      });
      expect(members.length).toBeGreaterThanOrEqual(2);
    });
  });

  test("is a no-op when already disabled", async () => {
    await withTestTransaction(async (tx) => {
      await disableSso({ ctx: { ...scaleCtx, db: tx } });
      const row = await tx
        .select()
        .from(workspace)
        .where(eq(workspace.id, scaleCtx.workspace.id))
        .get();
      expect(row?.ssoEnabled).toBe(false);
    });
  });

  test("rejects read-only actor", async () => {
    await withTestTransaction(async (tx) => {
      await enableSso({ ctx: { ...scaleCtx, db: tx, workos: fakeWorkOS() } });

      await expect(
        disableSso({ ctx: { ...readOnlyCtx(), db: tx } }),
      ).rejects.toBeInstanceOf(ForbiddenError);

      const row = await tx
        .select()
        .from(workspace)
        .where(eq(workspace.id, scaleCtx.workspace.id))
        .get();
      expect(row?.ssoEnabled).toBe(true);
    });
  });
});

describe("createSsoPortalLink", () => {
  test("throws when SSO has not been set up", async () => {
    await withTestTransaction(async (tx) => {
      await expect(
        createSsoPortalLink({
          ctx: { ...scaleCtx, db: tx, workos: fakeWorkOS() },
          input: { intent: "sso", returnUrl: "https://app.test/settings/sso" },
        }),
      ).rejects.toBeInstanceOf(PreconditionFailedError);
    });
  });

  // A portal link is a capability to reconfigure the IdP, so it counts as a
  // write even though the verb itself touches no row.
  test("rejects read-only actor", async () => {
    await withTestTransaction(async (tx) => {
      await expect(
        createSsoPortalLink({
          ctx: { ...readOnlyCtx(), db: tx, workos: fakeWorkOS() },
          input: { intent: "sso", returnUrl: "https://app.test/settings/sso" },
        }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });
  });
});

describe("syncSsoDomain", () => {
  test("inserts a verified domain and is idempotent on replay", async () => {
    await withTestTransaction(async (tx) => {
      await enableSso({ ctx: { ...scaleCtx, db: tx, workos: fakeWorkOS() } });

      const systemCtx = makeSystemCtx(scaleCtx.workspace, {
        job: "workos-webhook",
      });
      const verifiedAt = new Date(1_700_000_000_000);

      await syncSsoDomain({
        ctx: { ...systemCtx, db: tx },
        input: {
          organizationId: "org_test_1",
          domain: "acme.test",
          verifiedAt,
        },
      });
      await syncSsoDomain({
        ctx: { ...systemCtx, db: tx },
        input: {
          organizationId: "org_test_1",
          domain: "acme.test",
          verifiedAt,
        },
      });

      const rows = await tx
        .select()
        .from(workspaceSsoDomain)
        .where(eq(workspaceSsoDomain.workspaceId, scaleCtx.workspace.id))
        .all();
      expect(rows.length).toBe(1);
      expect(rows[0].verifiedAt?.getTime()).toBe(verifiedAt.getTime());
    });
  });

  test("removeSsoDomain deletes the row", async () => {
    await withTestTransaction(async (tx) => {
      await enableSso({ ctx: { ...scaleCtx, db: tx, workos: fakeWorkOS() } });
      const systemCtx = makeSystemCtx(scaleCtx.workspace, {
        job: "workos-webhook",
      });

      await syncSsoDomain({
        ctx: { ...systemCtx, db: tx },
        input: {
          organizationId: "org_test_1",
          domain: "acme.test",
          verifiedAt: new Date(),
        },
      });
      await removeSsoDomain({
        ctx: { ...systemCtx, db: tx },
        input: { organizationId: "org_test_1", domain: "acme.test" },
      });

      const rows = await tx
        .select()
        .from(workspaceSsoDomain)
        .where(eq(workspaceSsoDomain.workspaceId, scaleCtx.workspace.id))
        .all();
      expect(rows.length).toBe(0);

      const [audited] = await readAuditLog({
        workspaceId: scaleCtx.workspace.id,
        entityType: "workspace_sso",
        entityId: scaleCtx.workspace.id,
        db: tx,
      });
      expect(audited?.action).toBe("workspace_sso.delete");
      expect(audited?.metadata).toEqual({ domain: "acme.test" });
      expect(audited?.after).toBe(null);
    });
  });

  test("rejects read-only actor", async () => {
    await withTestTransaction(async (tx) => {
      await enableSso({ ctx: { ...scaleCtx, db: tx, workos: fakeWorkOS() } });

      await expect(
        syncSsoDomain({
          ctx: { ...readOnlyCtx(), db: tx },
          input: {
            organizationId: "org_test_1",
            domain: "acme.test",
            verifiedAt: new Date(),
          },
        }),
      ).rejects.toBeInstanceOf(ForbiddenError);

      const rows = await tx
        .select()
        .from(workspaceSsoDomain)
        .where(eq(workspaceSsoDomain.workspaceId, scaleCtx.workspace.id))
        .all();
      expect(rows.length).toBe(0);
    });
  });

  test("removeSsoDomain rejects read-only actor", async () => {
    await withTestTransaction(async (tx) => {
      await enableSso({ ctx: { ...scaleCtx, db: tx, workos: fakeWorkOS() } });
      const systemCtx = makeSystemCtx(scaleCtx.workspace, {
        job: "workos-webhook",
      });
      await syncSsoDomain({
        ctx: { ...systemCtx, db: tx },
        input: {
          organizationId: "org_test_1",
          domain: "acme.test",
          verifiedAt: new Date(),
        },
      });

      await expect(
        removeSsoDomain({
          ctx: { ...readOnlyCtx(), db: tx },
          input: { organizationId: "org_test_1", domain: "acme.test" },
        }),
      ).rejects.toBeInstanceOf(ForbiddenError);

      const rows = await tx
        .select()
        .from(workspaceSsoDomain)
        .where(eq(workspaceSsoDomain.workspaceId, scaleCtx.workspace.id))
        .all();
      expect(rows.length).toBe(1);
    });
  });
});

describe("reconcileSsoDomains", () => {
  test("mirrors a domain the webhook never delivered", async () => {
    await withTestTransaction(async (tx) => {
      await enableSso({ ctx: { ...scaleCtx, db: tx, workos: fakeWorkOS() } });

      const domains = await reconcileSsoDomains({
        ctx: { ...scaleCtx, db: tx },
        organizationId: "org_test_1",
        workos: fakeWorkOS({
          domains: [
            { domain: "acme.test", state: "verified" },
            { domain: "later.test", state: "pending" },
          ],
        }),
        local: [],
      });

      expect(domains.length).toBe(2);
      expect(
        domains.find((entry) => entry.domain === "acme.test")?.verifiedAt,
      ).toBeInstanceOf(Date);
      expect(
        domains.find((entry) => entry.domain === "later.test")?.verifiedAt,
      ).toBe(null);

      const allowed = await isEmailAllowedForWorkspace(
        scaleCtx.workspace.id,
        "jane@acme.test",
        tx,
      );
      expect(allowed).toBe(true);
    });
  });

  test("keeps the first verification timestamp and drops removed domains", async () => {
    await withTestTransaction(async (tx) => {
      await enableSso({ ctx: { ...scaleCtx, db: tx, workos: fakeWorkOS() } });
      const verifiedAt = new Date(1_700_000_000_000);

      await syncSsoDomain({
        ctx: {
          ...makeSystemCtx(scaleCtx.workspace, { job: "workos-webhook" }),
          db: tx,
        },
        input: {
          organizationId: "org_test_1",
          domain: "acme.test",
          verifiedAt,
        },
      });

      const domains = await reconcileSsoDomains({
        ctx: { ...scaleCtx, db: tx },
        organizationId: "org_test_1",
        workos: fakeWorkOS({
          domains: [{ domain: "acme.test", state: "verified" }],
        }),
        local: [
          { domain: "acme.test", verifiedAt },
          { domain: "gone.test", verifiedAt },
        ],
      });

      expect(domains.length).toBe(1);
      expect(domains[0].domain).toBe("acme.test");
      expect(domains[0].verifiedAt?.getTime()).toBe(verifiedAt.getTime());
    });
  });
});

describe("domain lookup", () => {
  test("normalizeSsoDomain accepts an email or a bare domain", () => {
    expect(normalizeSsoDomain("Jane@Acme.TEST")).toBe("acme.test");
    expect(normalizeSsoDomain("  acme.test ")).toBe("acme.test");
    expect(normalizeSsoDomain("")).toBe(null);
  });

  test("unverified domains never resolve", async () => {
    await withTestTransaction(async (tx) => {
      await enableSso({ ctx: { ...scaleCtx, db: tx, workos: fakeWorkOS() } });
      const systemCtx = makeSystemCtx(scaleCtx.workspace, {
        job: "workos-webhook",
      });

      await syncSsoDomain({
        ctx: { ...systemCtx, db: tx },
        input: {
          organizationId: "org_test_1",
          domain: "pending.test",
          verifiedAt: null,
        },
      });

      const found = await getWorkspaceByVerifiedSsoDomain(
        "jane@pending.test",
        tx,
      );
      expect(found).toBe(null);

      const allowed = await isEmailAllowedForWorkspace(
        scaleCtx.workspace.id,
        "jane@pending.test",
        tx,
      );
      expect(allowed).toBe(false);
    });
  });

  test("verified domain resolves to the workspace and allows the email", async () => {
    await withTestTransaction(async (tx) => {
      await enableSso({ ctx: { ...scaleCtx, db: tx, workos: fakeWorkOS() } });
      const systemCtx = makeSystemCtx(scaleCtx.workspace, {
        job: "workos-webhook",
      });

      await syncSsoDomain({
        ctx: { ...systemCtx, db: tx },
        input: {
          organizationId: "org_test_1",
          domain: "acme.test",
          verifiedAt: new Date(),
        },
      });

      const found = await getWorkspaceByVerifiedSsoDomain("jane@acme.test", tx);
      expect(found?.id).toBe(scaleCtx.workspace.id);

      const allowed = await isEmailAllowedForWorkspace(
        scaleCtx.workspace.id,
        "jane@acme.test",
        tx,
      );
      expect(allowed).toBe(true);

      const foreign = await isEmailAllowedForWorkspace(
        scaleCtx.workspace.id,
        "ceo@bigcorp.test",
        tx,
      );
      expect(foreign).toBe(false);
    });
  });

  test("a disabled workspace does not resolve", async () => {
    await withTestTransaction(async (tx) => {
      await enableSso({ ctx: { ...scaleCtx, db: tx, workos: fakeWorkOS() } });
      const systemCtx = makeSystemCtx(scaleCtx.workspace, {
        job: "workos-webhook",
      });
      await syncSsoDomain({
        ctx: { ...systemCtx, db: tx },
        input: {
          organizationId: "org_test_1",
          domain: "acme.test",
          verifiedAt: new Date(),
        },
      });
      await disableSso({ ctx: { ...scaleCtx, db: tx } });

      const found = await getWorkspaceByVerifiedSsoDomain("jane@acme.test", tx);
      expect(found).toBe(null);
    });
  });
});

describe("joinSsoWorkspace", () => {
  function enabledCtx(base: ServiceContext): ServiceContext {
    return { ...base, workspace: { ...base.workspace, ssoEnabled: true } };
  }

  test("provisions the member and audits the join", async () => {
    await withTestTransaction(async (tx) => {
      const newcomer = await createUser();
      const ctx = enabledCtx(
        makeUserCtx(scaleCtx.workspace, { userId: newcomer.id }),
      );

      await joinSsoWorkspace({
        ctx: { ...ctx, db: tx },
        input: { userId: newcomer.id },
      });

      const membership = await tx.query.usersToWorkspaces.findFirst({
        where: and(
          eq(usersToWorkspaces.userId, newcomer.id),
          eq(usersToWorkspaces.workspaceId, scaleCtx.workspace.id),
        ),
      });
      expect(membership?.role).toBe("member");

      await expectAuditRow({
        workspaceId: scaleCtx.workspace.id,
        action: "member.create",
        entityType: "member",
        entityId: newcomer.id,
        actorType: "user",
        db: tx,
      });
    });
  });

  test("a repeat login keeps the existing role and emits no second row", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = enabledCtx(
        makeUserCtx(scaleCtx.workspace, { userId: SCALE_OWNER_ID }),
      );

      await joinSsoWorkspace({
        ctx: { ...ctx, db: tx },
        input: { userId: SCALE_OWNER_ID },
      });

      const membership = await tx.query.usersToWorkspaces.findFirst({
        where: and(
          eq(usersToWorkspaces.userId, SCALE_OWNER_ID),
          eq(usersToWorkspaces.workspaceId, scaleCtx.workspace.id),
        ),
      });
      expect(membership?.role).toBe("owner");

      const rows = await readAuditLog({
        workspaceId: scaleCtx.workspace.id,
        entityType: "member",
        entityId: SCALE_OWNER_ID,
        db: tx,
      });
      expect(rows.length).toBe(0);
    });
  });

  test("rejects a workspace with sso switched off", async () => {
    await withTestTransaction(async (tx) => {
      const newcomer = await createUser();
      await expect(
        joinSsoWorkspace({
          ctx: { ...scaleCtx, db: tx },
          input: { userId: newcomer.id },
        }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });
  });

  test("rejects read-only actor", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = enabledCtx(readOnlyCtx());
      await expect(
        joinSsoWorkspace({
          ctx: { ...ctx, db: tx },
          input: { userId: SCALE_MEMBER_ID },
        }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });
  });
});
