import { api } from "@/trpc/server";

export default async function GeneralPage() {
  const data = await api.workspace.getWorkspace.query();

  return (
    <div className="text-muted-foreground">
      Your workspace slug is:{" "}
      <span className="text-foreground pl-1 font-medium">{data.slug}</span>.
    </div>
  );
}
