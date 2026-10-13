# DESIGN.md

How openstatus UI should look, feel and be built. `AGENTS.md` says where code
lives and what breaks; this file says what good looks like. Read both before
touching anything a user sees. Rules are short on purpose: the reason is the
rule, and the exception is in review.

## Principles

- **Hierarchy over decoration.** A page has one loud level and one quiet
  level. Authored content (a note, an update, a postmortem) is loud. State
  changes and system events are quiet. If everything is emphasized, nothing
  is.
- **Quiet by default.** Start from `text-muted-foreground` and lift only the
  word that matters to `text-foreground`. Borders, fills and color are earned.
- **Compose, don't invent.** A new screen is existing primitives in a new
  arrangement. A new primitive is a reviewed decision, not a side effect of a
  feature.
- **Unseen details compound.** Nobody notices a 160ms press or a
  dashed-underline hover on its own. Together they are why the product feels
  right.
- **Learnable by repetition.** The same shape on every incident, report and
  maintenance teaches the workflow without a tour. Consistency across pages
  beats a better idea on one page.

## Components

### Where things live

| Layer | Path | Rule |
|---|---|---|
| shadcn primitives | `packages/ui/src/components/ui/` | Stock. Edited only as a documented last resort, see `packages/ui/AGENTS.md`. |
| Public blocks | `packages/ui/src/components/blocks/` | Published registry. Imports nothing from an app; apps import them freely. |
| Shared custom | `packages/ui/src/components/custom/` | Ours, used by more than one app. |
| App kits | `apps/*/src/components/content/`, `common/` | Compound kits a whole app composes from. |
| Feature rows | `apps/*/src/components/<feature>/` | What a feature renders with the kits. |

A repeated visual is a new part in a kit, never a copied class stack. A
feature-specific row (an incident event, a report update) lives in the feature
folder and imports the kit; it does not add exports to the kit.

### Compound components

One kit per concept, small export list, every part a plain element wrapper:

```tsx
export function TimelineItem({ children, className, ...props }: React.ComponentProps<"li">) {
  return (
    <li data-slot="timeline-item" className={cn("relative grid …", className)} {...props}>
      {children}
    </li>
  );
}
```

- Props are `React.ComponentProps<"tag">` plus the few the part owns. Spread
  the rest, merge `className` with `cn`, always set `data-slot`.
- Parent context is expressed in CSS, not props:
  `in-data-[slot=timeline-card]:text-foreground` lets an actor render muted in a
  row and bold in a card without a `variant` prop.
- State is expressed through attributes the browser already sets:
  `aria-pressed:`, `data-[state=open]:`, `aria-invalid:`, `disabled:`. Style
  the attribute, never a parallel boolean class.
- Keep the kit at the number of exports it needs. `Timeline` has eleven. If
  a feature needs a twelfth, first ask whether it is a row in the feature file.
- Children, not render props, for layout. Slot props (`renderMessage`,
  `asChild`) only where a block must stay free of app dependencies.

### Variants

- `cva` for the visual axes of a part, `VariantProps` for the type. Status
  variants are `default | success | warning | destructive | info`, pinned with
  `satisfies Record<StatusVariant, string>` so a missing one fails typecheck.
- `className` is for layout (margin, width, grid placement). It is not for
  restyling a part's colors or type; add a variant instead.
- Prefer a boolean switch (`dot`, `plain`) over a new variant when it only
  removes chrome.
- `gap-*` on flex and grid, never `space-x-*` / `space-y-*`. `size-*` when
  width equals height. `truncate` plus `min-w-0` on the flex child.

### Primitives

When a shadcn primitive is not enough, in order: pass `className`, wrap it in
a kit part, add a variant to the wrapper. Editing `ui/` is a last resort with a
comment saying why. Shared UI comes from `@openstatus/ui`; an app never forks a
primitive (`docs/adr/0003`).

## Hierarchy and layout

- **Two row kinds, one rail.** A list of events has a compact sentence row
  (icon, muted sentence, time) and a card (avatar, header, body, optional
  footer, actions top-right). The rule for which: an authored message is a
  card, everything else is a row. The rail runs between every item, including
  card to card and composer to first item.
- **Sentences, not labels.** A row reads "Thibault marked Resolved", not
  "Status changed · Thibault". The actor and the lifted value carry the only
  emphasis.
- **Composer first, newest first.** On anything time-ordered the input sits
  on top and the latest item is directly below it. During an incident you want
  to know what just happened.
- **Content left, properties right.** Detail pages are a main column
  (header, composer, timeline, postmortem) and an aside of label/value
  properties. The aside is reference; it never competes with the timeline. A
  linked entity is one row with its actions behind a menu, not a card with a
  primary button.
- **Section title plus count.** `Activity 10`, `Updates 3`. The count is mono
  and muted.
- **Spacing.** Lists `gap-4`, cards `px-4`, inside a row `gap-2.5`, stacked
  compact rows pull up with a short rail. Pages cap at `max-w-6xl`. Padding
  is symmetric unless the asymmetry is explained in a comment.
- **Empty states** use the dashed `EmptyStateContainer` with a title and one
  sentence that says what to do next. Never a bare "No data".
- **Inline editing.** Title and summary are borderless inputs that show their
  edge on hover and focus. Save on blur or explicit action; never on every
  keystroke.
- **Hover affordance** is a dashed, muted underline (`decoration-dashed
  decoration-muted-foreground/50 underline-offset-2`). Not a color change, not
  a chevron, not a dot.

## Color

- Tokens only: `background`, `foreground`, `muted`, `muted-foreground`,
  `border`, `ring`, `success`, `warning`, `info`, `destructive`. They are OKLCH in
  `packages/ui/src/globals.css`. Never a raw palette class (`text-emerald-600`).
- Dark mode comes from the tokens. No `dark:` color overrides in components.
  Images in content pages get a `.dark` sibling file.
- Status color sits on the smallest element that can carry it: a `StatusDot`,
  the word in a sentence, the icon in a disc. Chrome stays neutral.
- Tinted chrome is one recipe: `border-{token}/20 bg-{token}/10 text-{token}`.
  Inside a sentence use `StatusBadge plain` (dot and mono text, no border).
  Bordered badges belong in cards and tables.
- Impact and status labels on the status page are colored text only.
- A new token goes into `registry.json` `cssVars` too, or it is undefined for
  everyone who installs a block.
- Contrast: 4.5:1 for text, 3:1 for icons, focus rings and borders that
  carry meaning. Muted text on a muted fill is the usual offender; check it in
  both themes.

## Typography

- Sans for prose, labels and buttons. Mono for values: ids, counts, dates,
  durations, statuses, anything a user might copy or compare.
- `tabular-nums` on any number that updates in place so columns do not jitter.
- No font sizes beyond the scale. Hierarchy comes from weight and color
  before size: `font-medium text-foreground` for the lifted word, size only
  for the page title.
- Relative time in the row (`2d ago`), absolute time with timezone in a hover
  card. Both from `HoverCardTimestamp`; never format a date inline.
- Wrapped sentences are allowed. Icons top-align (`items-start`) so a two-line
  row still reads.
- Sentence case everywhere. Brand is `openstatus`, lowercase, except at the
  start of a sentence. Click paths use `>`: `Settings > Integrations`.

## Radius

The scale is proportional to the themed `--radius` (`xs` 0.2, `sm` 0.6, `md`
0.8, `lg` 1.0, `xl` 1.4). Prefer `rounded-lg`. Never hard-code a pixel radius.
`rounded-full` only wraps a glyph. The status page and the marketing site set
`--radius` to 0, so a radius in a demo is dead code. Details in
`packages/ui/AGENTS.md`.

## Motion

CSS transitions only. There is no animation library in this repo and none is
planned.

- **Ask first whether it should move.** Something seen a hundred times a day
  (command menu, keyboard shortcuts, list navigation) does not animate.
  Hover and press get feedback, not motion. Modals, drawers and toasts get a
  standard transition. Only rare moments may delight.
- **Durations.** Press feedback 100–160ms. Tooltips 125–200ms. Dropdowns and
  selects 150–250ms. Modals and drawers 200–300ms. Nothing in the UI over
  300ms.
- **Easing.** `ease-out` for anything entering or leaving. `ease-in-out` for
  movement on screen. `ease` for color and hover. Never `ease-in`.
- **Transition named properties**, never `transition-all`. Prefer
  `transform` and `opacity`; they do not trigger layout.
- **Press feedback** on pressables we own (kit parts, blocks, custom):
  `active:scale-[0.97]` with the press duration above, on press rather than
  release. The stock `ui/button` stays untouched; add it through a wrapper
  class, not by editing `ui/`.
- **Never enter from `scale(0)`.** Start at 0.95 or higher with opacity.
- **Popovers scale from their trigger**
  (`origin-(--radix-popover-content-transform-origin)`). Modals stay centered.
- **Second tooltip opens instantly.** The delay guards the first hover only.
- **`motion-reduce:`** on every transition that moves or scales. Fades may
  stay.
- `@starting-style` for enter animations when support allows, the
  `data-mounted` pattern otherwise. No `useEffect` just to animate.

## Interaction and accessibility

- **Native elements.** A `button` acts, a link navigates. No `div` with
  `role="button"`. Space and Enter both work on a button because it is one.
- **Every icon-only control has a label**: `aria-label` plus a tooltip that
  shows the same text and the shortcut if there is one. Decorative glyphs
  (`StatusDot`, rail icons) are `aria-hidden`.
- **Focus is visible.** Never remove the `focus-visible` ring; override it
  with the token ring if a layout needs it. Keep focus inside overlays and
  return it to the trigger on close. The shadcn primitives already do this; a
  custom popover must too.
- **Overlays have a title.** Dialog, Sheet, Drawer always get a title;
  `sr-only` when the design hides it.
- **Forms.** Every control has a connected label. Placeholder text is not a
  label. Validation sets `aria-invalid` on the control and `data-invalid` on
  the field. Errors read next to the field, not only in a toast.
- **Keyboard.** `⌘↵` submits a composer, `Escape` leaves it, a single letter
  toggles a mode (`E` for preview). Shortcuts ignore key repeat, ignore
  typing inside inputs, textareas and open overlays, and show in the tooltip.
- **Targets.** 24×24px minimum on desktop, 44×44px where touch is likely.
  Pad the hit area, not the icon.
- **Loading.** `Skeleton` for layouts, `Spinner` with `disabled` on a button.
  No `isLoading` prop on a primitive; compose it.
- **Destructive actions confirm** with a dialog that names the thing being
  removed. The last item in a required list cannot be deleted; hide the
  action rather than erroring.
- **Toasts** carry an error the user can act on. A failed background call is
  never silent.

## Responsive and mobile

- Mobile first. Breakpoints follow the content, not devices. `sm:` for two
  columns, `md:` for the full layout. A four-column grid steps through two.
- No horizontal page scroll at 320px. Tables overflow in their own scroller
  (`overscroll-behavior: contain`); pages never do.
- `hover:` styles apply only where hover exists. Tailwind v4 compiles `hover:`
  to `(hover: hover)`; do not reintroduce ungated hover with raw CSS. Touch
  users get `:active` feedback instead.
- `touch-action: manipulation` on tappable elements removes the double-tap
  delay. `-webkit-tap-highlight-color: transparent` globally, then every
  tappable has its own `:active` state.
- Inputs are 16px on touch so iOS does not zoom. Never disable zoom.
- `100dvh` for app shells, drawers and bottom-pinned UI; `100svh` for heroes.
  Fixed bars pad with `env(safe-area-inset-*)` and the viewport meta sets
  `viewport-fit=cover`.
- Swap structure with `useIsMobile` only when CSS cannot: Dialog becomes
  Drawer, a row of actions becomes a menu. Everything else is a breakpoint.
- Gate on capability (`(pointer: coarse)`, `(hover: hover)`), never on the
  user agent.
- Test on a phone, not only in the emulator. Sticky hover, the keyboard and
  safe areas do not reproduce.

## HTML

- Semantic first: `ol` for ordered timelines, `time` with `dateTime` for
  every timestamp, `header`/`section`/`aside` where the page has those parts,
  one `h1`, headings in order.
- Interactive inside interactive is a bug: no button in a link, no link in a
  button. A card that is clickable has one link, overlaid, and the rest is
  inert to the click.
- Images declare `width` and `height` or `fill`; no layout shift on load.
- `color-scheme: light dark` on the root; `theme-color` once per scheme.
- No manual `z-index` on overlays; the primitives own the stack.
- `inert` on background content while an overlay is open comes from the
  primitive. Do not reimplement focus trapping.

## Worst cases

Before calling a view done, render it with:

- a 255-character title, an email with no break opportunity, a one-letter
  name, a name with emoji
- no avatar, no author (legacy rows), no description
- 0, 1 and 1,000 items; a count of 1 that must not say "1 updates"
- 320px wide, the widest layout, 200% zoom
- both themes

Flex failures look like squished avatars (`shrink-0`), text that overflows
instead of wrapping (`min-w-0`), actions pushed off-screen, badges on two
lines, and a last row clipped mid-glyph.

## Verify by looking

An agent cannot judge rendering from a diff. For any visible change,
`scripts/screenshot.mjs` (the `screenshot` skill) shoots the element, not the
viewport, in both themes on the local dev server of the dashboard, the
marketing site or the status page, logging in with a seeded session where
needed. Selectors differ per app: `[data-slot=timeline]` and the other
dashboard slots, `main` or a section on the marketing site, the block slots
from `packages/ui/src/components/blocks/` on the status page. Compare against the previous state. Feedback
goes back the same way: a screenshot with the problem boxed and one sentence.
Marketing and docs pages render every component on `/kitchen-sink` so drift
is visible there first.
