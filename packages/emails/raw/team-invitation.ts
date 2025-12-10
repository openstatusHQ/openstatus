import { renderTemplateWithFooter } from "./_components";

const BASE_URL = "https://openstatus.dev/app/invite";

interface TeamInvitationEmailProps {
  invitedBy: string;
  workspaceName?: string | null;
  token: string;
  baseUrl?: string;
}

export function renderTeamInvitationEmail({
  invitedBy,
  workspaceName,
  token,
  baseUrl = BASE_URL,
}: TeamInvitationEmailProps) {
  return renderTemplateWithFooter(
    `
    <p>Hello 👋</p>
    <p>You have been invited to join ${
      workspaceName || "openstatus.dev"
    } by ${invitedBy}.</p>
    <p>Click here to accept the invitation: <a href="${baseUrl}?token=${token}">accept invitation</a></p>
    <p>If you don't have an account yet, it will require you to create one.</p>
    `,
    "You've been invited to join openstatus.dev",
  );
}
