import { createElement } from "react";

import { slugify } from "./heading";

export function Details({
  children,
  summary,
  open = false,
  headingLevel,
}: {
  children: React.ReactNode;
  summary: string;
  open?: boolean;
  /**
   * Renders the summary as a real heading. Set it where the block is a section
   * of the page outline — an FAQ entry under an `h2` — so crawlers see the
   * nesting. Styling is neutralised in `globals.css`; the look is unchanged.
   */
  headingLevel?: 2 | 3 | 4;
}) {
  return (
    <details id={slugify(summary)} open={open}>
      <summary>
        {headingLevel
          ? createElement(`h${headingLevel}`, null, summary)
          : summary}
      </summary>
      {children}
    </details>
  );
}
