export const playbookType = [
  "incident_response",
  "status_page",
  "maintenance_windows",
  "postmortem",
] as const;

export type PlaybookType = (typeof playbookType)[number];

export const PLAYBOOK_MAX_CHARS = 10_000;

export const playbookLabel: Record<PlaybookType, string> = {
  incident_response: "Incident response",
  status_page: "Status page",
  maintenance_windows: "Maintenance windows",
  postmortem: "Postmortem",
};

export const playbookDescription: Record<PlaybookType, string> = {
  incident_response:
    "How you run an incident: severities, roles, steps, update cadence, escalation.",
  status_page:
    "How you write on the status page: tone, what to say and never say, sign-off, public names for internal systems.",
  maintenance_windows:
    "What a maintenance window means for you, when you schedule one, the notice period and what the notice says.",
  postmortem: "The sections of your postmortems and what goes in each.",
};
