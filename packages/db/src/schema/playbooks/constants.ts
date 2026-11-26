// Built-in slugs. A workspace has at most one playbook per slug.
export const playbookSlugs = [
  "incident-response",
  "status-page",
  "maintenance-windows",
  "postmortem",
] as const;

export type PlaybookSlug = (typeof playbookSlugs)[number];

export const PLAYBOOK_MAX_CHARS = 10_000;
export const PLAYBOOK_TITLE_MAX_CHARS = 100;
export const PLAYBOOK_DESCRIPTION_MAX_CHARS = 500;

/** Shown until the team sets its own title. */
export const playbookDefaultTitle: Record<PlaybookSlug, string> = {
  "incident-response": "Incident response",
  "status-page": "Status page",
  "maintenance-windows": "Maintenance windows",
  postmortem: "Postmortem",
};

/** Shown until the team sets its own description. */
export const playbookDefaultDescription: Record<PlaybookSlug, string> = {
  "incident-response":
    "How you run an incident: severities, roles, steps, update cadence, escalation.",
  "status-page":
    "How you write on the status page: tone, what to say and never say, sign-off, public names for internal systems.",
  "maintenance-windows":
    "What a maintenance window means for you, when you schedule one, the notice period and what the notice says.",
  postmortem: "The sections of your postmortems and what goes in each.",
};
