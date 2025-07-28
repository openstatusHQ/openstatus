import { Unkey } from "@unkey/api";

import { env } from "@/env";
import { api } from "@/trpc/server";
import { ApiKeys } from "./_components/card";

export const revalidate = 0;

const unkey = new Unkey({ token: env.UNKEY_TOKEN, cache: "no-cache" });

export default async function ApiTokenPage() {
  const workspace = await api.workspace.getWorkspace.query();

  const data = await unkey.apis.listKeys({
    apiId: env.UNKEY_API_ID,
    ownerId: String(workspace.id),
  });

  if (data.error) {
    return <div>Something went wrong. Please contact us.</div>;
  }

  const value = data.result.keys?.[0] || undefined;

  return <ApiKeys ownerId={workspace.id} value={value} />;
}
