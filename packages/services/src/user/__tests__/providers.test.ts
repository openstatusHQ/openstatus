import { db } from "@openstatus/db";
import { account } from "@openstatus/db/src/schema";
import { createUser } from "@openstatus/db/src/test/factories";
import { describe, expect, test } from "vitest";

import { listUserProviders } from "../index.ts";

async function link(userId: number, provider: string) {
  await db.insert(account).values({
    userId,
    type: "oauth",
    provider,
    providerAccountId: crypto.randomUUID(),
  });
}

describe("listUserProviders", () => {
  test("one entry per linked account, empty without any", async () => {
    const user = await createUser();
    expect(await listUserProviders({ input: { userId: user.id } })).toEqual([]);

    await link(user.id, "github");
    await link(user.id, "resend");

    const providers = await listUserProviders({ input: { userId: user.id } });
    expect(providers.sort()).toEqual(["github", "resend"]);
  });
});
