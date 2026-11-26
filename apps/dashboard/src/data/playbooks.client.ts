import {
  type PlaybookType,
  playbookType,
} from "@openstatus/db/src/schema/playbooks/constants";

export function playbookSlug(type: PlaybookType): string {
  return type.replaceAll("_", "-");
}

export function playbookTypeFromSlug(slug: string): PlaybookType | undefined {
  return playbookType.find((type) => playbookSlug(type) === slug);
}

/** What the agent consults this playbook for. */
export const playbookUsedFor: Record<PlaybookType, string> = {
  incident_response: "Declaring incidents",
  status_page: "Status reports",
  maintenance_windows: "Maintenance notices",
  postmortem: "Postmortem drafts",
};

/** Starting text a team can save as is and edit later; written to work without changes. */
export const playbookTemplate: Record<PlaybookType, string> = {
  incident_response: `# Incident response

## When to declare
Declare an incident as soon as customers are affected or are about to be. When in doubt, declare. A canceled incident costs nothing; a late one costs trust.

## Severity
| Severity | When | First public update | Then update | Postmortem |
| --- | --- | --- | --- | --- |
| critical | A core flow is down for most customers, or data is at risk | within 15 minutes | every 15 minutes | required |
| major | A core flow is degraded for many customers, or down for some | within 15 minutes | every 30 minutes | required |
| minor | Limited impact, or a workaround exists | within 2 hours, if customers notice | every 2 hours | optional |

Pick the higher severity when unsure. Lower it once the impact is understood.

## Roles
- Commander: whoever declares the incident, until they hand over. Decides, delegates and keeps the timeline. Does not debug.
- Communications: writes the status page. The commander does it when nobody else is named.
- Everyone else: works on the fix and reports findings in the incident channel.

## Steps
- [ ] Declare the incident with a severity and a commander.
- [ ] Publish a status report within the time the severity allows, even if the cause is unknown.
- [ ] Add notes to the timeline for every decision and every change made to production.
- [ ] Post public updates at the cadence above, also when nothing changed.
- [ ] Set the incident to mitigated when customers stop being affected.
- [ ] Resolve the incident and the status report once the fix is confirmed.
- [ ] Write the postmortem within five working days for critical and major incidents.

## Escalation
- critical: page the on-call engineer and inform the engineering lead immediately.
- major: page the on-call engineer; inform the engineering lead within 30 minutes.
- minor: handle during working hours.`,

  status_page: `# Status page communication

## Audience
The status page is read by customers. Write for someone who uses the product and does not know how it is built.

## Tone
- Calm, plain and direct. Short sentences, present tense, "we".
- Say what we know. Say what we do not know yet.
- No apologies in every update. Apologize once, in the final update.

## Every update says
1. What is affected, in terms of what customers can and cannot do.
2. What we are doing about it right now.
3. When the next update comes.

Keep an update to two to four sentences.

## Never
- Promise a time for the fix unless it is certain.
- Name vendors, internal systems, hostnames or people.
- Guess at the cause. Name it only once it is confirmed.
- Use "minor", "small" or "brief" to describe what customers are experiencing.
- Use internal jargon or abbreviations.

## Names
Use the component names exactly as they appear on the status page.

## By status
- investigating: what customers see, and that we are looking into it.
- identified: what is wrong in one plain sentence, and what we are doing.
- monitoring: what we changed, and what we are watching before we call it resolved.
- resolved: what happened, how long it lasted, that it is over, and an apology.

## Maintenance notices
Say what will happen, when (in UTC), what customers will notice and whether they need to do anything.`,

  maintenance_windows: `# Maintenance windows

## What it is
Planned work that customers may notice: a deploy with downtime, a database upgrade, a provider migration. It is announced on the status page before it starts. Work that customers cannot notice needs no window.

## When we schedule
- Outside our customers' business hours, Tuesday to Thursday when possible.
- Never on a Friday, before a public holiday or during a customer launch.
- One window at a time. No window while an incident is open.

## Notice
| Expected impact | Announce at least |
| --- | --- |
| Downtime | 7 days before |
| Degraded performance | 3 days before |
| No expected impact, but risk | 1 day before |

Notify subscribers when the window is created and again when it starts.

## The notice says
1. What we are doing, in one sentence, without internal names.
2. When: start and end in UTC.
3. What customers will notice during the window.
4. What they need to do, or that they need to do nothing.

## During the window
- Pause the affected monitors, or keep them checking without alerts, for the length of the window.
- Post an update when the work starts and when it is done.
- If the work will run past the end time, extend the window and post an update before the end time passes.

## When it goes wrong
If customers are affected beyond what was announced, declare an incident and follow the incident response playbook.`,

  postmortem: `# Postmortem

Blameless: describe what happened and why the system allowed it, never who did it. Write it for someone who was not in the incident.

## Summary
Three to five sentences: what happened, who was affected, for how long, and what fixed it.

## Impact
Who was affected and how, with numbers where we have them: duration, share of customers or requests, what they could not do.

## Timeline
The key moments in UTC: first impact, detection, declaration, each decision, mitigation, resolution.

## Root cause
What made this possible. Go past the trigger to the conditions behind it.

## What went well
What helped us detect, decide or recover faster.

## What went wrong
What slowed us down or made the impact worse.

## Action items
One item per line with an owner and a due date. Only items that reduce the chance or the impact of this happening again.`,
};
