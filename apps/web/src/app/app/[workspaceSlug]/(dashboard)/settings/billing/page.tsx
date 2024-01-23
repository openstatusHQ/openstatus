import { api } from "@/trpc/server";
import { SettingsPlan } from "./_components/plan";

export default async function BillingPage() {
  const workspace = await api.workspace.getWorkspace.query();
  return (
    <div className="grid gap-3">
      <h3 className="text-lg font-medium">
        <span className="capitalize">{workspace.plan}</span> plan
      </h3>
      <SettingsPlan workspace={workspace} />
    </div>
  );
}
