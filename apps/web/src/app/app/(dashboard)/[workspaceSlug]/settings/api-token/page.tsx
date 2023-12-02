import { api } from "@/trpc/server";
import { ApiKeys } from "./_components/card";

export default async function ApiTokenPage() {
  const data = await api.workspace.getWorkspace.query();

  if (!data) return <>Workspace not found</>;
  return <ApiKeys ownerId={data.id} />;
}
