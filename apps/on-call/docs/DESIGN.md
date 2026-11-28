# Design — On-call

**Status:** Draft
**Date:** 2026-11-28
**Scope:** v0 for small teams
**Companions:** `PRD.md` in this folder, `DESIGN.md` at the repository root

---

## 1. How this document is used

The repository root `DESIGN.md` defines how openstatus UI looks, feels, and is
built. This document does not restate those rules. It applies them to on-call:
which screens exist, which existing parts compose them, and which states each
screen must handle.

Every screen here is built from existing kits under
`apps/dashboard/src/components/content/` and `apps/dashboard/src/components/common/`.
No new primitive is required. A new kit part is added only if a repeated visual
cannot be expressed with an existing part.

## 2. Principles applied

- **One loud level per screen.** The "Right now" block on the overview and the
  page title on a detail screen. Everything else stays muted.
- **Quiet by default.** Muted text, lifted only where the responder must read.
- **Sentences, not labels.** "Ana is off 14:00–16:00", not "Override · active".
- **Status color on the smallest element.** A dot and the word. Chrome stays
  neutral.
- **Compose, do not invent.** Existing parts, new arrangement.
- **The acknowledgement is the product.** It must be reachable in one action
  from every screen that shows a live page.

## 3. Status vocabulary

| State | Variant | Color placement | Meaning |
| --- | --- | --- | --- |
| Triggered | `destructive` | dot and word | Page sent, nobody has acknowledged |
| Delivered | `default` | dot only | A channel accepted the message |
| Escalated | `warning` | dot and word | Moved to the next responder |
| Acknowledged | `success` | dot and word | A person has the page |
| Resolved | `success` | dot only, muted text | The monitor recovered |
| Uncovered | `warning` | dot and word | No responder is on call for a window |

Rules:

- Never use color alone. The word always accompanies the dot.
- `destructive` is reserved for an unacknowledged page. It is not used for
  configuration errors.
- Resolved pages lose their loudness. They stay readable, not prominent.

## 4. Screens

### 4.1 On-call overview — `/on-call`

Replaces the current "Coming soon" placeholder. Answers "who is on call right
now?" without a click.

```
On-call                                              [Test page]
Who is responding right now, and what is waiting on them.

RIGHT NOW
┌───────────────────────────────────────────────────────────────┐
│ ● Primary     Ana Souza        until Mon 09:00                │
│               email · slack · phone verified                  │
│                                                               │
│ ● Secondary   Rui Costa        until Mon 09:00                │
│               email · slack                                   │
│ ───────────────────────────────────────────────────────────── │
│ ▲ Ana is off 14:00–16:00 today · Rui covers · "dentist"       │
└───────────────────────────────────────────────────────────────┘

Schedules 2                                              [New]
┌───────────────────────────────────────────────────────────────┐
│ Platform    Ana · Rui · Mei     weekly, Mon 09:00    ● live   │
│ Payments    Rui · Mei           weekly, Mon 09:00    ▲ gap    │
└───────────────────────────────────────────────────────────────┘

Open pages 1
┌───────────────────────────────────────────────────────────────┐
│ ● Triggered  api.openstatus.dev 503   Ana Souza    2m ago     │
│   step 1 of 2 · escalates to Rui in 3m        [Acknowledge]   │
└───────────────────────────────────────────────────────────────┘
```

Notes:

- `Acknowledge` sits on the row. One click, no navigation, no confirmation.
- The channel list under each name states what will actually reach them. A
  missing channel is visible, never silent.
- The override line is a sentence, not a badge.
- `Schedules` and `Open pages` are sections with a count in mono, per the root
  design system.

Empty state (no schedules):

```
        [icon]
        No on-call schedule
        Create a rotation so a failing monitor reaches a person, not a channel.
        [ Create schedule ]
```

### 4.2 Schedule detail — `/on-call/schedules/[id]`

```
← Schedules

Platform                                                 [Edit]
Weekly rotation · handover Monday 09:00 · Europe/Lisbon

Next 4 weeks
┌───────────────────────────────────────────────────────────────┐
│            Mon 1     Mon 8     Mon 15    Mon 22               │
│ Primary    Ana       Rui       Mei       Ana                  │
│ Secondary  Rui       Mei       Ana       Rui                  │
└───────────────────────────────────────────────────────────────┘

Rotation order 3                              [Add override]
┌───────────────────────────────────────────────────────────────┐
│ 1  Ana Souza      primary      Mon 09:00 → Mon 09:00          │
│ 2  Rui Costa      secondary    Mon 09:00 → Mon 09:00          │
│ 3  Mei Lin        third        Mon 09:00 → Mon 09:00          │
└───────────────────────────────────────────────────────────────┘

Overrides 1
┌───────────────────────────────────────────────────────────────┐
│ Ana off   today 14:00–16:00   Rui covers   "dentist"    [x]   │
└───────────────────────────────────────────────────────────────┘
```

Notes:

- Position in the list is the escalation order. Position one is primary,
  position two is secondary. There is no second schedule to keep in sync.
- The four-week grid is the primary visual. It must be scannable at a glance.
- Overrides render as sentences with a cancel action. Cancelling is
  destructive and confirms with a dialog that names the window.
- Removing the last engineer in the rotation is blocked; the action is hidden
  rather than shown and rejected.

### 4.3 Page detail — `/on-call/pages/[id]`

```
← Pages

api.openstatus.dev returned 503                      ● Triggered
2 minutes ago · Platform schedule · step 1 of 2

[ Acknowledge ]   [ Escalate now ]   [ Resolve ]

Activity 5
  ┌ Ana Souza · voice call ──────────────────────── 2m ago ┐
  │ rang 22s, no answer                                     │
  └─────────────────────────────────────────────────────────┘
  ─ Ana Souza · email · delivered
  ─ Ana Souza · slack DM · delivered
  ─ Page triggered by monitor
  ─ Monitor incident opened

┌ Escalates to Rui Costa in 3:00 ────────────────────────────┐
```

Aside:

```
Monitor    api.openstatus.dev
Regions    fra, iad, sfo
Error      503 Service Unavailable
Policy     Platform
Incident   #142  ↗
Paged      Ana Souza
Acked by   —
```

Notes:

- The countdown is the tension of the screen. It gets its own block, not a
  badge, and it is the only element that updates in place.
- A voice call attempt is a timeline card because it has an outcome to report.
  Email and Slack deliveries are rows, because they have only a status.
- `Acknowledge` is the first action in reading order and the widest.
- `Resolve` is destructive-adjacent and confirms.
- The aside is reference only. It never competes with the timeline.

Acknowledged state:

```
api.openstatus.dev returned 503                   ● Acknowledged
3 minutes ago · acknowledged by Ana Souza 1m ago

[ Resolve ]
```

The actions row collapses to `Resolve`. The countdown block disappears. The
timeline gains a row naming the actor and the time.

### 4.4 Self-removal dialog

Opened from the overview or the schedule. `Dialog` on desktop, `Drawer` on
mobile.

Allowed:

```
Remove myself from on-call
You are primary until Mon 09:00.

For     [ 2 hours ▾ ]
Reason  [ Dentist appointment        ]

Cover check
✓ Rui Costa is on call for the whole window
✓ Rui has a verified phone number

                              [ Remove me ]  [ Cancel ]
```

Blocked:

```
Remove myself from on-call
✗ Nobody is on call after 16:00 today.
  Mei takes over Monday 09:00.

                        [ Ask Rui to cover ]  [ Cancel ]
```

Notes:

- The blocked state is the dialog's answer, not a toast. The reason and the
  next action live in the same place.
- The cover check lists each condition with its result. It is a checklist, not
  a sentence, because the user is checking a precondition.
- Duration options are fixed: 1, 2, 3, and 4 hours. No free-form entry in v0.
- `Remove me` is not styled as destructive. Removing yourself is a normal
  action, not a deletion.

### 4.5 Monitor detail aside

One block added to the existing properties panel.

Attached:

```
On-call
Policy      Platform                    [Change]
Primary     Ana Souza
Secondary   Rui Costa
            [ Send test page ]
```

Not attached:

```
On-call
Policy      None                      [Attach]
▲ Alerts on this monitor reach channels, not people.
```

Notes:

- The warning is a single sentence. It appears only when the monitor has at
  least one alert channel configured.
- `Send test page` is available from the monitor so an admin can verify
  delivery without waiting for an outage.

### 4.6 Pages list — `/on-call/pages`

```
Pages 42                                     [Filter ▾]

● Triggered    api.openstatus.dev    Ana Souza    2m ago
▲ Escalated    api.openstatus.dev    Rui Costa    14m ago
● Acknowledged web.openstatus.dev    Mei Lin      1h ago
  Resolved     api.openstatus.dev    Ana Souza    3h ago
```

Notes:

- `EventRow`, not cards. Pages are frequent and need to be scanned, not read.
- Status, monitor, responder, and relative time. Nothing else.
- Filter by status and by schedule. The filter is a table control, not a
  separate page.
- A filter that matches nothing uses the table's own "No matches" row with a
  clear action.

Empty state (no pages yet):

```
        [icon]
        No pages yet
        Pages appear when a monitor with an on-call policy fails.
        [ Send a test page ]
```

## 5. Component map

| Need | Existing part |
| --- | --- |
| Page shell | `SectionGroup`, capped at `max-w-6xl` |
| Section with count | `Section`, `SectionHeaderRow`, `SectionTitle` |
| Detail layout | `DetailHeader`, `DetailMain`, `DetailAside`, `DetailSection` |
| Page timeline | `Timeline`, `TimelineItem`, `TimelineCard`, `TimelineActor`, `TimelineTime` |
| Page list rows | `EventList`, `EventRow`, `EventRowStatus`, `EventRowTitle`, `EventRowActor` |
| Status | `StatusBadge`, `StatusDot` |
| Role chip | `Pill` for Primary and Secondary |
| Person | `UserAvatar` |
| Timestamps | `HoverCardTimestamp` |
| Override window | `DateTimePicker` |
| Properties aside | `PropertyList`, `Property`, `PropertyLabel`, `PropertyValue` |
| Empty states | `EmptyStateContainer`, `EmptyStateMedia`, `EmptyStateTitle`, `EmptyStateDescription`, `EmptyStateActions` |
| Self-removal | `Dialog` on desktop, `Drawer` on mobile through `useIsMobile` |
| Rotation grid | New kit part in `components/content/`, modelled on `ActivityCalendar` |

The rotation grid is the only candidate for a new part. `ActivityCalendar` is
shaped for contribution history: dense cells, no named rows, no shift labels.
A roster needs named rows, a column per week, and two rows per column. If the
existing grid cannot carry that without a `variant` that changes its meaning,
add one part to the content kit rather than copying classes into the feature
folder.

Feature-specific rows (a page event, a delivery attempt) live in
`apps/dashboard/src/components/on-call/` and import the kits. They do not add
exports to the kits.

## 6. States

Every screen handles five states.

| State | Treatment |
| --- | --- |
| Loading | `Skeleton` matching the final layout. No spinner on a whole page. |
| Empty | `EmptyState*` anatomy: icon, what belongs here, why it is empty, one action |
| Error | Inline message next to the failed region, with a retry action. Never a bare toast |
| Partial | A section that failed renders its own error; the rest of the page stays usable |
| Live | The countdown and current responder update in place without a full reload |

The overview must remain readable when the page has zero schedules, zero
policies, and zero pages. That is the first-run state for every new workspace.

## 7. Responsive

- Overview cards stack full width below `md`.
- The four-week roster scrolls horizontally inside its own container. The page
  never scrolls horizontally.
- On page detail, `Acknowledge` pins to the bottom of the viewport below `md`,
  padded for the safe area, with `100dvh` on the shell.
- Self-removal opens as a `Drawer` on mobile, `Dialog` on desktop.
- The page list drops the responder column below `sm`, keeping status, monitor,
  and time.

## 8. Accessibility

- The acknowledgement is a real `button`. Space and Enter both work because it
  is one.
- The countdown uses `aria-live="polite"` and announces at 60, 30, and 10
  seconds remaining. It does not announce every second.
- Status is never conveyed by color alone. Dot plus word, always.
- Every icon-only control has an `aria-label` and a tooltip with the same text.
- The cover check in the self-removal dialog uses a list with explicit
  success and failure text, not a colored icon alone.
- Focus returns to the trigger when the dialog closes.
- The roster grid is a table with proper headers, not a grid of divs.
- Contrast is checked in both themes. Muted text on a muted fill is the usual
  offender.

## 9. Motion

- No animation on the countdown. It updates in place.
- Acknowledgement state change is a 160ms fade on the status word and the
  actions row.
- The escalation block does not pulse, flash, or bounce.
- `motion-reduce:` is applied to every transition that moves or scales.
- A page arriving while the overview is open does not animate the whole list.
  The new row is inserted, and its status dot carries the change.

## 10. Open design decisions

1. **Roster grid.** Reuse `ActivityCalendar` or add one part to the content kit?
   Recommendation: add one part. The calendar is activity-shaped, the roster is
   shift-shaped.
2. **Acknowledge inside a list row.** Adds a mutation inside a list. Confirm it
   does not collide with the row's navigation target.
3. **Countdown treatment.** Text only, or a thin progress rail under the
   escalation block? Recommendation: text only in v0.
4. **Voice call detail.** Duration and outcome only. No recording, no
   transcript.
5. **Density.** Three to five engineers fit the roster grid. At ten, the grid
   needs week paging. Decide the ceiling before building.
6. **Overrides on the roster.** Shown inline as a replaced name, or as a
   separate row beneath the week? Recommendation: inline, with the original
   name struck through on hover only.

## 11. Worst cases to render before calling a screen done

- A 255-character monitor name.
- A name with emoji and a one-letter name.
- No avatar.
- Zero schedules, zero policies, zero pages.
- One page, which must not read "1 pages".
- One thousand pages.
- 320px width, the widest layout, and 200% zoom.
- Both themes.
- An escalation that fires while the page is open.

Flex failures to watch for: squished avatars, text that overflows instead of
wrapping, actions pushed off screen, badges on two lines, a last row clipped
mid-glyph.

## 12. Verification

Screens are verified by looking, not by reading a diff. `scripts/screenshot.mjs`
shoots the element on desktop and mobile against the local dashboard, logged in
with a seeded session. Selectors use the `data-slot` attributes from the kits.
Feedback is a screenshot with the problem boxed and one sentence.
