# PRD — On-call

**Status:** Draft
**Date:** 2026-11-28
**Owner:** TBD
**Scope:** v0 for small teams
**Companions:** `DESIGN.md` in this folder

---

## 1. Summary

OpenStatus tells a team that a monitor failed. It does not tell the team who
must act, when to escalate, or whether anyone acknowledged.

This document defines **v0 of a native on-call product**: a small-team rotation
with a primary and a secondary responder, acknowledgement confirmation,
recurring schedules, phone alerts that bypass Do Not Disturb, and a short
self-removal window that only applies when another engineer can cover.

The document is organised around two things: the features we ship, and the
blockers that stand between the design and a working page.

## 2. Scope

v0 is five capabilities. Nothing else ships.

1. Primary and secondary responder.
2. Acknowledgement confirmation.
3. Recurring schedules.
4. Phone alerts that bypass Do Not Disturb.
5. Short self-removal with a cover check.

Every other capability is listed as a later phase and is out of scope for v0.

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

**Out of scope in v0.** More than two named roles, multiple schedules per team,
follow-the-sun routing across regions.

### 3.2 Acknowledgement confirmation

**What it does.** A page has a state: triggered, delivered, escalated,
acknowledged, resolved. Acknowledging is one action from the dashboard, the page
list, or the phone call. Acknowledgement stops escalation immediately.

**Why it matters.** Acknowledgement is the only proof that a human has the
problem. Without it, the team cannot tell a page that was handled from a page
that was ignored.

**Required for it to work.**

- Acknowledgement from at least two surfaces: dashboard and phone call.
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

### 3.4 Phone alerts that bypass Do Not Disturb

**What it does.** The primary receives a voice call within one minute of a page.
The call states the monitor name and the failure. Pressing a key on the call
acknowledges the page. If the call is not answered, escalation proceeds to the
secondary. Email and Slack DM are sent alongside the call as context.

**Why it matters.** Email and Slack do not wake a sleeping phone. A page that
arrives silently is not a page. This feature is the difference between an alert
and an on-call product.

**Required for it to work.**

- A voice provider with call status callbacks and keypad input.
- A verified phone number per responder.
- A call retry policy before escalation.
- Every delivery attempt recorded with its outcome.
- A test page that reaches a real phone.

**Out of scope in v0.** Mobile push, SMS, call recording, transcripts, voice
menus beyond a single keypress.

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

| ID | Blocker | Blocks | Severity |
| --- | --- | --- | --- |
| B1 | Do Not Disturb cannot be bypassed by email or Slack | 3.4 | Critical |
| B2 | No mobile app, so no push channel | 3.4, future push | Critical |
| B3 | Voice provider not chosen, no keypad acknowledgement | 3.4 | Critical |
| B4 | Phone numbers unverified, no consent record | 3.4 | High |
| B5 | Cover check has no rule for partial coverage | 3.5 | High |
| B6 | Slack user mapping coverage is unknown | 3.2, context delivery | Medium |
| B7 | One-minute paging latency is the current floor | 3.4 | Medium |
| B8 | Page storm from many failing monitors | all | High |
| B9 | Timezone and daylight saving correctness | 3.3 | Medium |
| B10 | Plan gating and billing not modelled | launch | Medium |
| B11 | No migration path from existing tools | adoption | Medium |
| B12 | Support load from a trust-critical feature | launch | Medium |

### 4.2 Detail

**B1 — Do Not Disturb cannot be bypassed by email or Slack.**
Email and Slack are silent under Do Not Disturb on both mobile platforms. SMS
is also silent. A voice call is the only channel that rings through without a
native app.

Options:

1. Voice call at launch. Works today, no app, no platform approval.
2. Mobile app with critical push. Correct long term, months of work, and Apple
   restricts the critical-alert entitlement.

Decision: voice call in v0.

**B2 — No mobile app.**
Without an app there is no push, no in-app acknowledgement, and no reliable
presence signal. This is why B1 has no cheap answer.

Options:

1. Ship v0 without any app and use voice as the wake-up channel.
2. Build a minimal app before launch. Moves the timeline by months.

Decision: no app in v0.

**B3 — Voice provider not chosen.**
The repository already uses Twilio for SMS. Twilio voice can place calls and
collect keypad input, but retry logic, call status handling, and the
acknowledgement flow must be built. A paging-specific provider ships those
pieces but adds a vendor and a cost.

Decision needed: Twilio, or a paging-specific provider. This decision gates 3.4
entirely.

**B4 — Phone numbers unverified.**
A wrong or unverified number means a call that never arrives. Consent and
retention rules for phone numbers must be defined before collecting them.

Required: verification step before voice is enabled, and a visible state when a
responder has no verified number.

**B5 — Cover check has no rule for partial coverage.**
If the covering engineer is on call for the first hour of a three-hour window,
the request must be blocked. Evaluating only the current moment would approve
it and create a gap.

Decision needed: block unless coverage exists for the whole window. Recommended.

**B6 — Slack user mapping coverage is unknown.**
Slack DM requires a mapped Slack account per responder. If mapping is missing,
the DM silently does not send. Voice and email must therefore be the primary
channels, and a missing mapping must be visible on the responder row.

**B7 — One-minute paging latency.**
The scheduler runs on a one-minute floor. The first page must be dispatched
immediately after the incident is recorded, with the scheduler as a safety net,
or the promise becomes "up to a minute" in the worst case.

**B8 — Page storm.**
Fifty failing monitors produce fifty pages. Without a per-workspace rate limit
or grouping, the on-call engineer is flooded and the feature loses trust on the
first bad day.

**B9 — Timezone and daylight saving.**
A rotation expressed in fixed durations drifts across a daylight saving change.
The handoff must be computed in the schedule's local time, and the timezone must
be shown wherever a handoff is displayed.

**B10 — Plan gating and billing not modelled.**
On-call needs a plan limit and a gate. Without it, the feature ships to every
tier with no way to control cost, especially voice.

**B11 — No migration path.**
Teams arriving from another tool will not rebuild schedules by hand. An importer
is not required for v0 but is required for adoption beyond design partners.

**B12 — Support load.**
A missed page is a trust incident, not a bug report. Support needs a runbook,
delivery logs the team can read, and a test page so customers can verify
themselves.

## 5. Launch gates

v0 ships only when every gate passes.

1. An admin creates a schedule with three engineers, weekly rotation, and sees
   the next four weeks with primary and secondary named.
2. The overview shows the current primary and secondary without navigation.
3. A monitor incident pages the primary within one minute.
4. The page reaches a phone with Do Not Disturb enabled.
5. An unanswered call escalates to the secondary after the delay.
6. Acknowledging from the dashboard stops escalation.
7. Acknowledging from the phone call stops escalation.
8. The secondary and all admins see who acknowledged, and when.
9. A monitor recovery resolves the page and notifies everyone who was paged.
10. An override replaces the rotation for its window and appears on the
    schedule.
11. Self-removal succeeds when cover exists for the whole window.
12. Self-removal is blocked with an explanation when cover does not exist.
13. An empty schedule shows a warning and escalation continues.
14. A test page reaches a real phone and can be acknowledged.
15. A non-admin cannot change schedules, policies, or other people's coverage.
16. Every page and every configuration change appears in the audit log.
17. A burst of failing monitors does not send an unbounded number of pages.

## 6. Later phases

**Next after v0.** SMS, Slack acknowledge buttons, signed acknowledge links,
escalation repeat and maximum duration, page history filters, per-user channel
preferences.

**After that.** Mobile push, voice menus, multiple schedules, follow-the-sun,
response metrics, API and Terraform, importer for existing tools.

## 7. Open decisions

1. Voice provider: existing Twilio account, or a paging-specific provider.
2. Should pressing a key on the call be the only phone acknowledgement path, or
   is a dashboard acknowledgement equally valid? Recommended: both.
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
