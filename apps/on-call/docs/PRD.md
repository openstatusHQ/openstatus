# PRD — On-call

**Status:** Draft
**Date:** 2026-11-28
**Owner:** TBD
**Scope:** v0 for small teams
**Companions:** `DESIGN.md`, `TECH.md`, `PLAN.md`

---

## 1. Summary

OpenStatus tells a team that a monitor failed. It does not tell the team who
must act, when to escalate, or whether anyone acknowledged.

This document defines **v0 of a native on-call product**: a small-team rotation
with a primary and a secondary responder, acknowledgement confirmation,
recurring schedules, and phone alerts delivered by a mobile app that breaks
through Do Not Disturb.

The document is organised around two things: the features we ship, and the
blockers that stand between the design and a working page.

## 2. Scope

v0 is five capabilities. Nothing else ships.

1. Primary and secondary responder.
2. Acknowledgement confirmation.
3. Recurring schedules.
4. Native push that bypasses Do Not Disturb.
5. Short self-removal with a cover check.

Paging channels are push only. Email and Slack are not on-call channels in v0.

## 3. Features

Each feature states what it does, why it matters, and what must be true for it
to work.

### 3.1 Primary and secondary responder

**What it does.** Each schedule has an ordered list of engineers. Position one
is primary, position two is secondary, and later positions form the escalation
tail. Primary is paged first. Secondary is paged when the primary does not
acknowledge within the configured delay.

**Why it matters.** A single owner means a single point of failure. Two named
roles cover sickness, travel, and a phone on silent without a second schedule
to maintain.

**Required for it to work.**

- A schedule with an explicit handoff time and timezone.
- An ordered participant list where position equals escalation order.
- A configurable escalation delay.
- Both roles visible at all times on the schedule and on the overview.
- A registered device per participant.

**Out of scope in v0.** More than two named roles, multiple schedules per team,
follow-the-sun routing across regions.

### 3.2 Acknowledgement confirmation

**What it does.** A page has a state: triggered, delivered, escalated,
acknowledged, resolved. Acknowledging is one action from the dashboard or from
the push notification on the lock screen. Acknowledgement stops escalation
immediately.

**Why it matters.** Acknowledgement is the only proof that a human has the
problem. Without it, the team cannot tell a page that was handled from a page
that was ignored.

**Required for it to work.**

- Acknowledgement from at least two surfaces: dashboard and the notification.
- A broadcast to primary, secondary, and admins naming who acknowledged and
  when.
- A timeline entry with actor and time.
- A rule for who may acknowledge. Any workspace member may, and the audit log
  records the actor.

**Out of scope in v0.** Acknowledgement by emoji reaction, acknowledgement
SLA reporting, automatic acknowledgement from another tool.

### 3.3 Recurring schedules

**What it does.** A schedule rotates through its participants on a repeating
interval, with a fixed handoff time in the schedule's timezone. Weekly is the
default. Daily and custom intervals are configurable. The next four weeks are
previewable.

**Why it matters.** A rotation that must be re-entered every week is abandoned
within a month. Recurrence is what makes on-call a standing arrangement instead
of a manual chore.

**Required for it to work.**

- A rotation interval and a handoff time.
- A timezone per schedule.
- A four-week preview.
- Overrides that replace the rotation for a window.
- A visible warning when the schedule has no participants, with escalation
  continuing regardless.

**Out of scope in v0.** Layer-based schedules, per-day shift patterns, holiday
calendars, iCal subscription.

### 3.4 Native push that bypasses Do Not Disturb

**What it does.** Every responder installs a React Native Expo app and registers
the device. A page is delivered as a push notification that breaks through Do
Not Disturb, appears on the lock screen, and can be acknowledged without opening
the app. If the page is not acknowledged, escalation proceeds to the secondary.

**Why it matters.** Email and Slack do not wake a sleeping phone. A page that
arrives silently is not a page. This feature is the difference between an alert
and an on-call product.

**Required for it to work.**

- A registered device per responder.
- iOS Critical Alerts entitlement, or Time Sensitive as the interim.
- Android Do Not Disturb access granted by the user.
- A delivery receipt per push, with a visible failure state.
- Persisted delivery state, so a restart does not drop a page.
- A test page that reaches a real device.

**Out of scope in v0.** Email, Slack DM, SMS, voice call, call recording.

### 3.5 Short self-removal with cover check

**What it does.** An engineer removes themselves from on-call for a short window
of one to four hours. The action applies only when another engineer is on call
for the entire window. When no cover exists, the request is blocked with an
explanation and an offer to ask the covering engineer.

**Why it matters.** People step away for an appointment or a school pickup
without warning. Without a supported path, they either ignore the rotation or
leave a silent gap.

**Required for it to work.**

- A cover check that evaluates the whole window, not just the current moment.
- A blocked state that names when the next person takes over.
- An offer to notify or ask the covering engineer.
- Automatic return to the rotation when the window ends.
- Both the removal and the return recorded in the page history and audit log.

**Out of scope in v0.** Multi-day leave, swap requests between two engineers,
approval workflows, on-call pay tracking.

## 4. Blockers

A blocker is anything that prevents a feature from working, or prevents us from
claiming it works. Each blocker states what it stops, the impact, the options,
and the decision required.

### 4.1 Blockers by severity

| ID | Blocker | Blocks | Severity | Status |
| --- | --- | --- | --- | --- |
| N1 | iOS Critical Alerts entitlement not granted | 3.4 | Critical | Open |
| N2 | Android DND bypass is permission-gated | 3.4 | Critical | Open |
| N4 | Push is the only paging channel, no fallback | 3.4 | Critical | Accepted |
| N5 | Responder with no registered device is unreachable | 3.1, 3.2 | High | Open |
| N6 | Decoupled service duplicates scope, audit, and limits | all | High | Accepted |
| N7 | Two schedulers can double-fire escalation | 3.3 | High | Open |
| N11 | Page storm from many failing monitors | all | High | Open |
| N13 | Cover check has no rule for partial coverage | 3.5 | High | Open |
| N3 | Expo Go cannot deliver; needs EAS build and native modules | 3.4 | High | Open |
| N17 | In-memory retry is not durability | 3.4 | High | Open |
| N8 | Push receipts are after-the-fact only | 3.4 | Medium | Open |
| N9 | App Store review and TestFlight for design partners | launch | Medium | Open |
| N10 | Timezone and daylight saving correctness | 3.3 | Medium | Open |
| N12 | Plan gating and billing not modelled | launch | Medium | Open |
| N14 | Support load on a trust-critical feature | launch | Medium | Open |
| N16 | Effect v4 is a release candidate | all | Medium | Accepted |
| N18 | Two error models across the boundary | all | Medium | Accepted |
| N15 | No migration path from existing tools | adoption | Low | Later |

### 4.2 Detail

**N1 — iOS Critical Alerts entitlement.**
Push cannot bypass Do Not Disturb on iOS without
`com.apple.developer.usernotifications.critical-alerts`. Apple grants it by
application, only where a missed alert is a safety risk, and rejects often.

Options:

1. Apply now, ship with `interruptionLevel: "timeSensitive"` until approved.
   Time Sensitive breaks through Focus only when the user allows it.
2. Block v0 on the entitlement.

Decision: apply now, ship Time Sensitive as the interim, keep Critical Alerts
as the target.

**N2 — Android DND bypass is permission-gated.**
A notification channel with `bypassDnd` works only after the user grants Do Not
Disturb access in system settings. High importance alone does not bypass DND.
Full-screen intent over the lock screen needs its own permission.

Required: an onboarding step that requests the access, detection of the granted
state, and a warning on the responder row when it is missing.

**N3 — Expo Go cannot deliver this.**
Critical alerts, full-screen intent, and custom channels need native modules
and a config plugin. Expo Go is out. Testing requires an EAS development build
and a config plugin around Notifee or equivalent.

**N4 — Push is the only paging channel.**
No email, no Slack, no SMS, no voice. If the device is offline, the token is
stale, the app was force-stopped, or the OS throttles delivery, the page is lost
with no second path.

Accepted risk. Mitigation: visible delivery receipts, a per-responder
"unreachable" state, and escalation continuing to the next responder.

**N5 — A responder with no registered device cannot be paged.**
Device registration becomes a precondition. A responder without a registered
device must be blocked from a schedule, or the schedule must show the gap.

**N6 — Decoupled service duplicates scope, audit, and limits.**
`apps/on-call` owns its own data access and does not call `packages/services`.
That duplicates scope checks, audit emission, plan limits, and workspace
membership, and needs a lint exemption.

Accepted risk. Mitigation: `packages/on-call-shared` holds credential
verification, scope checks, audit emission, and plan limit reads. Both servers
import it, so the logic is written once and used by two entry points.

**N7 — Two schedulers can double-fire escalation.**
`apps/workflows` already runs cron. If `apps/on-call` runs its own sweeper,
escalation must use a claim and lease, the pattern the notification outbox
already uses, or a page escalates twice.

**N8 — Push receipts are after-the-fact.**
A receipt tells us delivery failed. It does not reach a human. Failure handling
is escalation, not retry.

**N9 — App Store review and TestFlight.**
Design-partner testing needs TestFlight and Play internal testing, with review
time on the critical path for a public release.

**N10 — Timezone and daylight saving.**
A rotation expressed in fixed durations drifts across a daylight saving change.
The handoff is computed in the schedule's local time and shown with its
timezone.

**N11 — Page storm.**
Fifty failing monitors produce fifty pages to one device. A per-workspace rate
limit or grouping is required before launch.

**N12 — Plan gating and billing.**
On-call needs a plan limit and a gate. Without it the feature ships to every
tier with no cost control.

**N13 — Cover check and partial coverage.**
If the covering engineer is on call for the first hour of a three-hour window,
the request must be blocked. Evaluating only the current moment approves it and
creates a gap.

**N14 — Support load.**
A missed page is a trust incident, not a bug report. Support needs a runbook
and delivery logs the team can read.

**N15 — Migration path.**
Teams arriving from another tool will not rebuild schedules by hand. Not
required for v0, required for adoption beyond design partners.

**N16 — Effect v4 is a release candidate.**
`effect` is pinned at `4.0.0-rc.117` and shared by five packages. API churn is
expected, and an upgrade touches all of them at once.

Accepted risk. Mitigation: pin exactly, upgrade in one PR, never float the
range.

**N17 — In-memory retry is not durability.**
`Effect.retry` lives in the process. A restart mid-retry loses the attempt.
Delivery attempt count, next attempt time, and escalation time must be persisted
in the database, with the Effect loop only as a ticker.

Without this, a deploy during an outage silently drops pages.

**N18 — Two error models across the boundary.**
`packages/services` throws, `apps/on-call` uses typed Effect errors. Every call
across that boundary needs an adapter, and an untyped throw can escape into the
Effect channel as a defect.

Accepted risk. Mitigation: one adapter module, no raw service calls in handlers.

## 5. Launch gates

v0 ships only when every gate passes.

1. An admin creates a schedule with three engineers, weekly rotation, and sees
   the next four weeks with primary and secondary named.
2. The overview shows the current primary and secondary without navigation.
3. A monitor incident pages the primary within one minute.
4. The page reaches a device with Do Not Disturb enabled.
5. An unacknowledged page escalates to the secondary after the delay.
6. Acknowledging from the dashboard stops escalation.
7. Acknowledging from the push notification stops escalation.
8. The secondary and all admins see who acknowledged, and when.
9. A monitor recovery resolves the page and notifies everyone who was paged.
10. An override replaces the rotation for its window and appears on the
    schedule.
11. Self-removal succeeds when cover exists for the whole window.
12. Self-removal is blocked with an explanation when cover does not exist.
13. An empty schedule shows a warning and escalation continues.
14. A test page reaches a real device and can be acknowledged.
15. A non-admin cannot change schedules, policies, or other people's coverage.
16. Every page and every configuration change appears in the audit log.
17. A burst of failing monitors does not send an unbounded number of pages.
18. A restart during an active page does not lose the escalation.

## 6. Later phases

**Next after v0.** Escalation repeat and maximum duration, page history filters,
per-user channel preferences, response metrics.

**After that.** Multiple schedules, follow-the-sun, API and Terraform, importer
for existing tools, additional delivery channels through the channel registry.

**Not planned.** Email and Slack as on-call paging channels. They stay as
monitor alert channels, not as a way to wake a responder.

## 7. Open decisions

1. If the Critical Alerts entitlement is refused, is Time Sensitive acceptable
   as the permanent iOS ceiling?
2. Should a responder without a registered device be blocked from a schedule,
   or allowed with a visible warning? Recommended: blocked.
3. Escalation delay: fixed at five minutes, or configurable per policy?
   Recommended: configurable, default five minutes.
4. Maximum self-removal window: four hours, or longer? Recommended: four hours.
5. Should a page open a managed incident automatically? Recommended: no, offer
   it as an action from the page.
6. Page history retention: 90 days on paid, 14 on free?
7. Is the secondary a named person per shift or a second schedule?
   Recommended: named person per shift.
8. What is the participant ceiling for a single schedule before the roster grid
   needs paging? Recommended: ten.
