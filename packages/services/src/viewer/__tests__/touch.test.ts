import { eq } from "@openstatus/db";
import { viewer } from "@openstatus/db/src/schema";
import { describe, expect, test } from "vitest";

import { withTestTransaction } from "../../../test/helpers";
import { touchViewer } from "../index.ts";

describe("touchViewer", () => {
  test("stamps updatedAt", async () => {
    await withTestTransaction(async (tx) => {
      const row = await tx
        .insert(viewer)
        .values({
          email: `viewer-${crypto.randomUUID()}@example.com`,
          updatedAt: new Date(0),
        })
        .returning()
        .get();

      // the column stores whole seconds
      const before = Math.floor(Date.now() / 1000) * 1000;
      await touchViewer({ input: { id: row.id }, db: tx });

      const after = await tx
        .select()
        .from(viewer)
        .where(eq(viewer.id, row.id))
        .get();
      expect(after?.updatedAt?.getTime()).toBeGreaterThanOrEqual(before);
    });
  });
});
