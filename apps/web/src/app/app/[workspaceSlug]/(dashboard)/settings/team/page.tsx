import { ProFeatureAlert } from "@/components/billing/pro-feature-alert";
import { columns as invitationColumns } from "@/components/data-table/invitation/columns";
import { DataTable as InvitationDataTable } from "@/components/data-table/invitation/data-table";
import { columns as userColumns } from "@/components/data-table/user/columns";
import { DataTable as UserDataTable } from "@/components/data-table/user/data-table";
import { api } from "@/trpc/server";
import { InfoBanner } from "./_components/info-banner";
import { InviteButton } from "./_components/invite-button";

export default async function TeamPage() {
  const workspace = await api.workspace.getWorkspace.query();
  const invitations = await api.invitation.getWorkspaceOpenInvitations.query();
  const users = await api.workspace.getWorkspaceUsers.query();

  const isFreePlan = workspace.plan === "free";

  return (
    <div className="flex flex-col gap-4">
      {isFreePlan ? <ProFeatureAlert feature="Team members" /> : null}
      {!isFreePlan && !workspace.name ? <InfoBanner /> : null}
      {/* TODO: only show if isAdmin */}
      <div className="flex justify-end">
        <InviteButton disabled={isFreePlan} />
      </div>
      <UserDataTable
        data={users.map(({ role, user }) => ({ role, ...user }))}
        columns={userColumns}
      />
      {invitations.length > 0 ? (
        <InvitationDataTable data={invitations} columns={invitationColumns} />
      ) : null}
    </div>
  );
}
