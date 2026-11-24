import { eq } from "@openstatus/db";
import { page } from "@openstatus/db/src/schema";
import { createPage } from "@openstatus/db/src/test/factories";
import { beforeAll, describe, expect, test } from "vitest";

import { getPublicStatusPageIndexing, getPublicStatusPageRow } from "..";
import {
  createWorkspaceFixture,
  withTestTransaction,
} from "../../../test/helpers";

let workspaceId: number;

beforeAll(async () => {
  workspaceId = (await createWorkspaceFixture("team")).workspace.id;
});

describe("getPublicStatusPageRow", () => {
  test("resolves by slug or custom domain, case-insensitively", async () => {
    await withTestTransaction(async (tx) => {
      const suffix = Math.random().toString(36).slice(2, 8);
      const p = await createPage(
        workspaceId,
        {
          slug: `row-${suffix}`,
          customDomain: `Status-${suffix}.example.com`,
          accessType: "password",
          password: "s3cret",
          allowIndex: false,
        },
        tx,
      );
      for (const slug of [`ROW-${suffix}`, `status-${suffix}.EXAMPLE.com`]) {
        const row = await getPublicStatusPageRow({ input: { slug }, db: tx });
        expect(row).toMatchObject({
          id: p.id,
          accessType: "password",
          allowIndex: false,
        });
        expect(Array.isArray(row?.authEmailDomains)).toBe(true);
      }
    });
  });

  test("an empty custom domain never matches, and an unknown host is null", async () => {
    await withTestTransaction(async (tx) => {
      await createPage(workspaceId, { customDomain: "" }, tx);
      expect(
        await getPublicStatusPageRow({ input: { slug: "" }, db: tx }),
      ).toBeNull();
      expect(
        await getPublicStatusPageRow({
          input: { slug: "no-such-page-x9" },
          db: tx,
        }),
      ).toBeNull();
    });
  });

  test("a row that no longer parses is null", async () => {
    await withTestTransaction(async (tx) => {
      const p = await createPage(workspaceId, {}, tx);
      await tx
        .update(page)
        // safe: bypasses the enum to simulate a legacy row
        .set({ accessType: "legacy" as never })
        .where(eq(page.id, p.id));
      expect(
        await getPublicStatusPageRow({ input: { slug: p.slug }, db: tx }),
      ).toBeNull();
    });
  });
});

describe("getPublicStatusPageIndexing", () => {
  test("returns only the routing and indexing fields", async () => {
    await withTestTransaction(async (tx) => {
      const p = await createPage(
        workspaceId,
        { accessType: "password", password: "s3cret", allowIndex: false },
        tx,
      );
      const row = await getPublicStatusPageIndexing({
        input: { slug: p.slug.toUpperCase() },
        db: tx,
      });
      expect(row).toEqual({
        slug: p.slug,
        customDomain: "",
        accessType: "password",
        allowIndex: false,
      });
      expect(
        await getPublicStatusPageIndexing({ input: { slug: "" }, db: tx }),
      ).toBeNull();
    });
  });
});
