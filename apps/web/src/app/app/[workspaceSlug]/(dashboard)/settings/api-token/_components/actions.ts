"use server";

import { Unkey } from "@unkey/api";

import { env } from "@/env";

const unkey = new Unkey({ token: env.UNKEY_TOKEN });

export async function create(ownerId: number) {
  const key = await unkey.keys.create({
    apiId: env.UNKEY_API_ID,
    ownerId: String(ownerId),
    prefix: "os",
  });
  return key;
}

export async function revoke(keyId: string) {
  const res = await unkey.keys.delete({ keyId });
  return res;
}
