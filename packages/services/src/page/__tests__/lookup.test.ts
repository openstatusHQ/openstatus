import { createPage } from "@openstatus/db/src/test/factories";
import { describe, expect, test } from "vitest";

import {
  createWorkspaceFixture,
  withTestTransaction,
} from "../../../test/helpers";
import {
  getPagePublicDomain,
  getPageTitleInWorkspace,
  resolvePageFromUrl,
} from "../lookup";

const unique = () => crypto.randomUUID().slice(0, 8);

describe("resolvePageFromUrl", () => {
  test("resolves an openstatus.dev subdomain by slug", async () => {
    const team = await createWorkspaceFixture("team");
    const slug = `lookup-${unique()}`;
    await withTestTransaction(async (tx) => {
      const page = await createPage(team.workspace.id, { slug }, tx);
      for (const raw of [
        `${slug}.openstatus.dev`,
        ` https://${slug}.openstatus.dev/events `,
      ]) {
        expect((await resolvePageFromUrl(raw, { db: tx }))?.id).toBe(page.id);
      }
    });
  });

  test("resolves a custom domain case-insensitively, with or without www", async () => {
    const team = await createWorkspaceFixture("team");
    const domain = `status-${unique()}.example.com`;
    await withTestTransaction(async (tx) => {
      const page = await createPage(
        team.workspace.id,
        { customDomain: domain.toUpperCase() },
        tx,
      );
      for (const raw of [domain, `https://www.${domain}/x`]) {
        const resolved = await resolvePageFromUrl(raw, { db: tx });
        expect(resolved?.id).toBe(page.id);
        expect(resolved?.title).toBe(page.title);
      }
    });
  });

  test("returns null for empty, nested or unknown hosts", async () => {
    await withTestTransaction(async (tx) => {
      for (const raw of [
        "  ",
        "a.b.openstatus.dev",
        ".openstatus.dev",
        `missing-${unique()}.example.com`,
      ]) {
        expect(await resolvePageFromUrl(raw, { db: tx })).toBeNull();
      }
    });
  });
});

describe("page lookups", () => {
  test("getPageTitleInWorkspace only answers for the owning workspace", async () => {
    const owner = await createWorkspaceFixture("team");
    const other = await createWorkspaceFixture("team");
    await withTestTransaction(async (tx) => {
      const page = await createPage(owner.workspace.id, { title: "Mine" }, tx);
      expect(
        await getPageTitleInWorkspace(
          { workspaceId: owner.workspace.id, pageId: page.id },
          tx,
        ),
      ).toBe("Mine");
      expect(
        await getPageTitleInWorkspace(
          { workspaceId: other.workspace.id, pageId: page.id },
          tx,
        ),
      ).toBeNull();
    });
  });

  test("getPagePublicDomain returns slug and custom domain", async () => {
    const team = await createWorkspaceFixture("team");
    await withTestTransaction(async (tx) => {
      const page = await createPage(
        team.workspace.id,
        { customDomain: "status.example.org" },
        tx,
      );
      expect(await getPagePublicDomain(page.id, { db: tx })).toEqual({
        slug: page.slug,
        customDomain: "status.example.org",
      });
      expect(await getPagePublicDomain(-1, { db: tx })).toBeUndefined();
    });
  });
});
