// Slugs with a default title, description and template. Any other slug is a
// custom playbook. A workspace has at most one playbook per slug.
export const builtinPlaybookSlugs = [
  "incident-response",
  "status-page",
  "maintenance-windows",
  "postmortem",
] as const;

export type BuiltinPlaybookSlug = (typeof builtinPlaybookSlugs)[number];

export function isBuiltinPlaybookSlug(
  slug: string,
): slug is BuiltinPlaybookSlug {
  return builtinPlaybookSlugs.some((s) => s === slug);
}

export const PLAYBOOK_SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const PLAYBOOK_SLUG_MAX_CHARS = 64;
// every playbook adds a line to the agent's prompt
export const PLAYBOOK_MAX_CUSTOM = 20;
export const PLAYBOOK_MAX_CHARS = 10_000;
export const PLAYBOOK_TITLE_MAX_CHARS = 100;
export const PLAYBOOK_DESCRIPTION_MAX_CHARS = 500;

const defaultTitle: Record<BuiltinPlaybookSlug, string> = {
  "incident-response": "Incident response",
  "status-page": "Status page",
  "maintenance-windows": "Maintenance windows",
  postmortem: "Postmortem",
};

const defaultDescription: Record<BuiltinPlaybookSlug, string> = {
  "incident-response":
    "How you run an incident: severities, roles, steps, update cadence, escalation.",
  "status-page":
    "How you write on the status page: tone, what to say and never say, sign-off, public names for internal systems.",
  "maintenance-windows":
    "What a maintenance window means for you, when you schedule one, the notice period and what the notice says.",
  postmortem: "The sections of your postmortems and what goes in each.",
};

/** Written to a built-in playbook created without a title; a custom slug stands in for itself. */
export function playbookDefaultTitle(slug: string): string {
  return isBuiltinPlaybookSlug(slug) ? defaultTitle[slug] : slug;
}

/** Written to a built-in playbook created without a description; empty for a custom slug. */
export function playbookDefaultDescription(slug: string): string {
  return isBuiltinPlaybookSlug(slug) ? defaultDescription[slug] : "";
}
