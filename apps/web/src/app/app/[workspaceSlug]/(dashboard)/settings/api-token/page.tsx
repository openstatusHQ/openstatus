import { api } from "@/trpc/server";
import { ApiKeys } from "./_components/card";

export default async function ApiTokenPage() {
  const data = await api.workspace.getWorkspace.query();

  return <ApiKeys ownerId={data.id} />;
}
