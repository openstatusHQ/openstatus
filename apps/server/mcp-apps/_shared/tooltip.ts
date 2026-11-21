import { htmlEl } from "./dom";

export type TooltipRow = { color: string; name: string; value: string };

/** A swatch in a series' colour, shared by tooltips and legends. */
export function seriesKey(color: string): HTMLSpanElement {
  const key = htmlEl("span", "key");
  key.style.background = color;
  return key;
}

/**
 * Fill and place a `.tooltip` beside `x` (in the container's pixels), flipping
 * to the left when it would overflow `containerWidth`.
 */
export function showTooltip(
  tooltip: HTMLElement,
  content: { heading: string; rows: TooltipRow[]; empty: string },
  position: { x: number; containerWidth: number },
) {
  tooltip.replaceChildren(htmlEl("div", "when", content.heading));
  if (content.rows.length === 0) {
    tooltip.append(htmlEl("div", "name", content.empty));
  }
  for (const row of content.rows) {
    const line = htmlEl("div", "row");
    line.append(
      seriesKey(row.color),
      htmlEl("span", "name", row.name),
      htmlEl("span", "value", row.value),
    );
    tooltip.append(line);
  }
  tooltip.hidden = false;
  const width = tooltip.offsetWidth;
  const { x, containerWidth } = position;
  const left = x + 12 + width > containerWidth ? x - 12 - width : x + 12;
  tooltip.style.left = `${Math.max(0, left)}px`;
}
