# Incident Severity Matrix Builder

Classify incidents with deterministic, auditable rules. Customize thresholds, test scenarios, and export a ready-to-use template for your runbook.

No guesswork. Transparent rules. Engineering-first.

---

## How It Works

1. Set the **percentage of users affected** (0–100%).
2. Toggle **security impact** and **SLA breach** if applicable.
3. Get an instant severity classification with response time, status page label, and communication urgency.
4. Optionally customize thresholds to match your team's definitions.
5. Export the full matrix as Markdown for your wiki, Notion, or runbook.

---

## Classification Rules

Severity is calculated using the following deterministic rule order:

1. **Security impact** → SEV0 – Critical (always)
2. **≥80% users affected** → SEV0 – Critical
3. **≥50% users affected** → SEV1 – High
4. **≥10% users affected** → SEV2 – Medium
5. **<10% users affected** → SEV3 – Low

**SLA modifier:** If an SLA breach is flagged and the calculated severity is lower than SEV1, the severity is upgraded by one level.

These thresholds are defaults. The builder lets you customize each threshold to match your team's operational reality.

---

## Severity Matrix Template

Copy this table directly into your runbook, wiki, or Notion page.

```markdown
| Severity | Users Affected | Security | Response Time | Status Page Label | Communication | Postmortem |
|----------|---------------|----------|---------------|-------------------|---------------|------------|
| 🔴 SEV0 – Critical | ≥80% OR security incident | Yes | 15 minutes | Major Outage | Immediate public update + all-hands | Required |
| 🟠 SEV1 – High | ≥50% | No | 30 minutes | Partial Outage | Public update within 15 min | Required |
| 🟡 SEV2 – Medium | ≥10% | No | 2 hours | Degraded Performance | Status page update + ticket | Required (team) |
| 🟢 SEV3 – Low | <10% | No | 1 business day | Minor Issue | Internal ticket only | Optional |
```

### Response Expectations Template

```markdown
| Severity | First Response | Update Cadence | Escalation Path | Auto-Escalate If |
|----------|---------------|----------------|-----------------|-----------------|
| SEV0 | 15 min | Every 15 min | VP Engineering + on-call | — |
| SEV1 | 30 min | Every 30 min | Engineering lead | Not resolved in 2h → SEV0 review |
| SEV2 | 2 hours | Every 2 hours | Team lead | Not resolved in 4h → SEV1 |
| SEV3 | 1 business day | Daily | Assigned engineer | Spreads to more systems → re-classify |
```

### Status Page Label Mapping

Map each severity level to the label shown on your public status page:

- SEV0 → **Major Outage** (red)
- SEV1 → **Partial Outage** (orange)
- SEV2 → **Degraded Performance** (yellow)
- SEV3 → **Minor Issue** (green)

These labels align with standard status page conventions used by tools like [OpenStatus](https://www.openstatus.dev).

---

## Test Scenarios

Use these real-world scenarios to validate your severity matrix before an actual incident happens.

**Database cluster failover**
Primary database fails over to replica. 2 minutes of downtime for 60% of users. No data loss.
→ SEV1 – High

**API authentication breach**
Unauthorized access detected on API keys. Only 5% of users affected, but security is compromised.
→ SEV0 – Critical (security override)

**CDN edge node degradation**
One CDN region serving stale assets. 15% of users see outdated content. Workaround: hard refresh.
→ SEV2 – Medium

**Payment processor timeout**
Stripe webhook failures causing 90% checkout failures. SLA breach triggered. No workaround available.
→ SEV0 – Critical

**CSS regression on settings page**
Button misaligned on settings page. 3% of users affected. Functional workaround exists.
→ SEV3 – Low

---

## Calculate Your SLA Downtime Allowance

Your severity levels directly impact whether you stay within SLA. A SEV0 incident burning through 8 hours of downtime means very different things depending on whether your SLA is 99.9% or 99.99%.

Use the [OpenStatus Uptime SLA Calculator](https://www.openstatus.dev/play/uptime-sla) to understand how much downtime each SLA tier actually allows — per day, month, and year.

---

## What Is an Incident Severity Matrix?

An incident severity matrix is a structured framework that classifies production incidents based on measurable impact: how many users are affected, whether security is compromised, and whether SLA commitments are at risk.

Without one, incident classification becomes subjective. Different engineers escalate differently. Status page updates are inconsistent. Response times vary depending on who's on call.

A well-defined severity matrix solves this by making classification deterministic. Given the same inputs, every engineer arrives at the same severity level, the same response time expectation, and the same communication protocol.

---

## SEV0 vs SEV1 vs SEV2 vs SEV3

**SEV0 – Critical**
Complete outage or security breach. No workaround available. Requires immediate response from senior engineering leadership. Public status page should show "Major Outage" and updates should go out every 15 minutes.

**SEV1 – High**
Major degradation affecting most users. Significant business or revenue impact. Requires urgent response from engineering leads. Status page shows "Partial Outage" with 30-minute update cadence.

**SEV2 – Medium**
Partial degradation with limited user impact. Standard incident process applies. Status page shows "Degraded Performance" and updates go out every 2 hours.

**SEV3 – Low**
Minor bug or cosmetic issue affecting a small percentage of users. Non-urgent resolution on a 1 business day timeline. Typically no public status page update is needed.

The key distinction: **severity measures impact**, not urgency. An issue can be low severity but high priority depending on business context. Your severity matrix should focus purely on measurable impact, while priority is a separate decision made during triage.

---

## How to Define Severity Levels for Your Status Page

1. **Define measurable thresholds.** Use percentage of users affected as your primary signal. Avoid vague definitions like "major issue" — if you can't measure it, you can't classify it consistently.

2. **Decide how security incidents are classified.** Most teams treat any confirmed security incident as SEV0 regardless of user impact. This is the safest default.

3. **Set response time targets per severity.** These should be realistic and achievable. A 15-minute response target for SEV0 only works if you have reliable on-call rotations.

4. **Map severity to status page labels.** Your internal severity levels should translate directly to what users see on your [status page](https://www.openstatus.dev). SEV0 = Major Outage, SEV1 = Partial Outage, and so on.

5. **Document the rules and make them accessible.** A severity matrix only works if every engineer can find it during an incident. Put it in your runbook, pin it in your incident Slack channel, and review it quarterly.

---

## Frequently Asked Questions

### What does SEV0 mean?

SEV0 indicates a critical incident — typically a complete service outage or confirmed security breach that requires immediate response from senior engineering leadership. It's the highest severity level and triggers the most aggressive communication and escalation protocols.

### How many severity levels should we use?

Most teams use 3 or 4 levels. Four levels (SEV0 through SEV3) provide enough granularity to distinguish between a full outage and a minor cosmetic bug without overcomplicating triage during a live incident. If you're a small team, 3 levels (Critical, Medium, Low) can work fine — you can always add granularity later.

### What is the difference between severity and priority?

Severity measures the impact of an incident — how many users are affected and how badly. Priority reflects business urgency and resource allocation. A typo on your pricing page might be low severity (no functional impact) but high priority (it's costing you conversions). Your severity matrix should classify based on impact alone; priority is a triage decision.

### Should security incidents always be SEV0?

In most cases, yes. Security incidents carry outsized risk even when few users are immediately affected — the blast radius can expand quickly and the reputational impact is disproportionate. Treating all confirmed security incidents as SEV0 ensures you mobilize the right resources immediately.

### How often should we review our severity matrix?

Review it quarterly, or after any major incident where the classification felt wrong. If your team consistently debates whether something is a SEV1 or SEV2, your thresholds probably need adjustment. The builder above lets you customize thresholds so your matrix reflects your team's actual operational patterns.

### How does this relate to SLA compliance?

Your severity levels determine how quickly you respond to incidents, which directly affects your cumulative downtime. If your SLA promises 99.9% uptime, you have roughly 8 hours and 46 minutes of allowed downtime per year. A single misclassified SEV0 that gets treated as SEV2 could burn through that budget. Use the [OpenStatus SLA Calculator](https://www.openstatus.dev/play/uptime-sla) to understand your actual downtime allowance.

---

## Why Deterministic Classification Matters

Subjective severity classification breaks down exactly when you need it most — during a live incident when stress is high and context is incomplete.

Deterministic rules remove the ambiguity. They reduce emotional escalation, improve consistency across incidents and teams, standardize communication with stakeholders, align alerting with real user impact, and integrate cleanly into monitoring and status page systems.

This builder gives you a transparent, engineering-first approach to incident classification. Define your thresholds, test them against real scenarios, and export a matrix your whole team can use.

**Watch out for severity inflation.** If your team is classifying 30% of incidents as SEV1, you've lost the signal. Over time, over-escalation causes on-call burnout, desensitizes the team to real emergencies, and wastes senior engineering time. Measurable thresholds — not judgment calls — are the fix.

**During a live incident, err high.** The cost of over-escalating a single incident is almost always lower than the cost of under-escalating and letting user impact compound. Assume the highest plausible severity when you first open the incident. Calibrate downward in the postmortem if you overshot.

## Incident Severity vs. Traditional Risk Matrices

A classical risk matrix (from project management and safety engineering) plots two axes: **likelihood** × **impact** to produce a risk score. The standard criticism of this approach — known as Cox's theorem — is that multiplying ordinal scales produces mathematically misleading scores, where risks with very different real-world values end up in the same cell ("range compression").

An incident severity matrix deliberately sidesteps both problems:

1. **Likelihood is always 1.** You're classifying an incident that is *already happening* — probability is not a variable. The matrix focuses entirely on impact dimensions.
2. **No multiplication.** Severity is determined by ordered rules, not by multiplying scores. Given the same inputs, you always get the same output.

This makes incident severity classification more reliable than classical risk matrices, which is exactly why it works under pressure.

## Severity vs Priority: The Distinction That Prevents Conflict

Severity and priority are not the same thing, and conflating them is one of the most common sources of engineering conflict during incidents.

**Severity** is objective: it measures the blast radius of the incident — how many users are affected and how badly. It does not change based on who's asking or what time it is.

**Priority** is contextual: it reflects how urgently the team should act, given business context. The same severity level can warrant different priorities depending on time of day, customer tier, or competitive pressures.

| Scenario | Severity | Priority | Why |
|----------|----------|----------|-----|
| API down for 90% of users | SEV0 | P0 | Total outage + business impact |
| Button misaligned on pricing page | SEV3 | P1 | Low impact but costs conversions |
| Slow dashboard for 5% of users | SEV2 | P3 | Limited impact, no SLA risk |
| Auth bug during enterprise demo | SEV2 | P0 | Low blast radius, massive business risk |

Your severity matrix classifies based on impact. Priority is a separate triage decision made by the on-call lead.

> A higher severity level also grants broader authority to take riskier recovery actions — e.g., a SEV0 may justify taking down a service entirely to restore stability, where a SEV2 would not.

---

## Technical Implementation Plan

Route: `/play/severity-matrix`

### Files to Create

```
apps/web/src/app/(landing)/play/severity-matrix/
├── page.tsx          # Server component: metadata, JSON-LD, layout
└── client.tsx        # "use client": interactive builder component

apps/web/src/content/pages/tools/
└── severity-matrix.mdx       # Tool MDX content + frontmatter (title, description, faq)

apps/web/src/content/pages/guides/
└── incident-severity-matrix.mdx  # Guide with templates, per-severity message examples, tips
```

### Files to Modify

- `apps/web/src/app/(landing)/play/page.tsx` — add entry to `PLAY` array
- No changes needed for guides routing — `guides/[slug]/page.tsx` picks it up automatically

### Patterns to Follow

Mirrors the structure of existing tools (reference: `uptime-sla`, `curl`):

- `page.tsx` calls `getToolsPage("severity-matrix")` for metadata + JSON-LD (`WebPage`, `BreadcrumbList`, `FAQPage`)
- `page.tsx` renders `<SeverityMatrixBuilder />` then `<CustomMDX source={page.content} />`
- `client.tsx` exports a named component (`SeverityMatrixBuilder`), no default export
- Styling: `rounded-none`, `h-auto!`, `p-4` on inputs — consistent with the tool aesthetic

### Component State

```ts
const [usersAffected, setUsersAffected] = useState(25);        // 0–100
const [securityImpact, setSecurityImpact] = useState(false);
const [slaBreach, setSlaBreach] = useState(false);
const [thresholdCritical, setThresholdCritical] = useState(80);
const [thresholdHigh, setThresholdHigh] = useState(50);
const [thresholdMedium, setThresholdMedium] = useState(10);
```

### UI Sections

1. **Calculator** — `Slider` (0–100) + two `Switch` toggles + result card (severity badge, response time, status page label, communication, postmortem required yes/no)
2. **Test Scenarios** — quick-select `Button` badges that pre-fill the inputs (one per scenario in the Test Scenarios section above)
3. **Customize Thresholds** — three `Input` fields for SEV0/SEV1/SEV2 thresholds

The matrix template (export) lives as a static ` ```markdown ``` ` code block in the MDX content — MDX code blocks already have built-in copy support, no extra export button needed.

### Classification Logic

```ts
type SeverityLevel = "SEV0" | "SEV1" | "SEV2" | "SEV3";
const SEV_ORDER = ["SEV0", "SEV1", "SEV2", "SEV3"] as const;

function classifySeverity(params): SeverityLevel {
  if (params.securityImpact) return "SEV0";

  let sev: SeverityLevel;
  if (params.usersAffected >= params.thresholdCritical) sev = "SEV0";
  else if (params.usersAffected >= params.thresholdHigh) sev = "SEV1";
  else if (params.usersAffected >= params.thresholdMedium) sev = "SEV2";
  else sev = "SEV3";

  // SLA modifier: upgrade one level if severity is below SEV1
  if (params.slaBreach && (sev === "SEV2" || sev === "SEV3")) {
    sev = SEV_ORDER[SEV_ORDER.indexOf(sev) - 1];
  }
  return sev;
}
```

### UI Components Available

All from `@openstatus/ui/components/ui/*`:

- `Slider` — for users affected percentage
- `Switch` — for security impact and SLA breach toggles
- `Input` — for threshold customization
- `Button` — for quick-select scenarios
- `Label` — for form labels

### Guide: `incident-severity-matrix.mdx`

Lives at `/guides/incident-severity-matrix`. No custom page or component needed — the existing `guides/[slug]/page.tsx` renders it automatically.

**Frontmatter:**
```yaml
title: "Incident Severity Matrix Guide"
description: "..."
author: "openstatus"
publishedAt: "2026-02-26"
category: "template"
howto:
  totalTime: "PT30M"
  steps:
    - name: "Define your severity thresholds"
    - name: "Classify the incident"
    - name: "Communicate based on severity"
    - name: "Escalate and update"
faq: [ ... same 6 questions as the tool MDX ... ]
```

**Content sections** (follow the pattern of `api-service-disruption.mdx` and `scheduled-maintenance.mdx`):

1. **When to Use This Guide** — brief bullets on when to reach for the severity matrix

2. **Severity Matrix** — the two updated template code blocks (matrix with Postmortem column + response expectations with Auto-Escalate column) — these are the primary copyable templates

3. **Status Page Message Templates by Severity** — per-SEV level message examples for each incident stage (Investigating → Identified → Monitoring → Resolved). Grounded in GitHub's real message patterns:
   - Investigating: "We are investigating reports of [impact description]."
   - Identified: "We have identified [root cause summary]. A fix is being deployed."
   - Monitoring: "A fix has been deployed. We are monitoring for full recovery."
   - Resolved: "This incident has been resolved. A postmortem will be published at [link]." ← the explicit postmortem commitment matters
   - Include the "never go more than 1 hour without a public update on any active SEV0/SEV1" rule

4. **Postmortem Requirements** — short table: SEV0/SEV1 always required, SEV2 required at team level, SEV3 optional. Closing the incident loop prevents recurrence.

5. **Severity vs Priority** — short prose + table; prevents the most common misclassification conflict

6. **Roles During a Severity Incident** — Incident Commander pattern: one person owns both the severity classification *and* the status page updates, preventing contradictory public messaging

7. **Real-World Examples** — the 5 test scenarios showing classification + example status page message per scenario

8. **Tips** — err high during live incidents + calibrate in postmortem; UTC timestamps in all public updates; pin matrix in incident Slack channel; if SEV2 is not resolved in 4h auto-escalate to SEV1 review; review thresholds quarterly or after any incident where classification was debated

Link back to the interactive builder: `/play/severity-matrix`

---

### Tool MDX Frontmatter

```yaml
title: "Incident Severity Matrix Builder"
publishedAt: "2026-02-26"
author: "Maximilian Kaske"
description: "Classify incidents with deterministic, auditable rules. ..."
category: "Product"
faq:
  - question: "What does SEV0 mean?"
    answer: "..."
  # ... 5 more from the FAQ section above
```

### MDX Content

Rendered below the interactive tool. Sections to include from this document:

| Section | Note |
|---------|------|
| Severity Matrix Template (code block) | Updated with Postmortem column |
| Response Expectations Template (code block) | Updated with Auto-Escalate column |
| What Is an Incident Severity Matrix? | Prose |
| SEV0 vs SEV1 vs SEV2 vs SEV3 | Prose |
| Severity vs Priority | Prose + table — key differentiator, reduces misclassification; link to guide for full templates |
| Incident Severity vs. Traditional Risk Matrices | Prose — grounds the tool in established methodology; explains why likelihood is omitted and why deterministic rules beat score multiplication |
| How to Define Severity Levels for Your Status Page | Prose |
| Why Deterministic Classification Matters | Prose — include severity inflation warning + err-high-during-incident rule |

Sections **not** needed in MDX (covered by the interactive UI or redundant):

- "How It Works" — replaced by the live tool
- "Classification Rules" — replaced by the live tool
- "Test Scenarios" — replaced by the quick-select buttons
- "Calculate Your SLA Downtime Allowance" — link to `/play/uptime-sla` in prose is enough
- "Frequently Asked Questions" — goes in frontmatter `faq:` for structured data, not as MDX prose
- Footer links — not needed in MDX

---

*Built by [OpenStatus](https://www.openstatus.dev) · Open-source monitoring and status pages*

*More free tools: [Uptime SLA Calculator](https://www.openstatus.dev/play/uptime-sla) · [cURL Builder](https://www.openstatus.dev/play/curl) · [All Tools](https://www.openstatus.dev/play)*
