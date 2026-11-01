// How far to shift a screenshot of `size` px, of which `visible` px show, so
// the span starting at `start` stays in view with a margin. Wide spans (a
// full-width input, a table row) only need their start and a third of the
// view: that is where their content is.
export function panFor(
  start: number,
  length: number,
  size: number,
  visible: number,
  margin = 48,
) {
  const max = Math.max(0, size - visible);
  const shown = Math.min(length, visible / 3);
  const offset = Math.min(
    Math.max(0, start + shown + margin - visible),
    Math.max(0, start - margin),
  );
  return Math.min(offset, max);
}
