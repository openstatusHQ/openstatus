import rehypeAutolinkHeadings from "rehype-autolink-headings";
import type { Options as RehypeAutolinkHeadingsOptions } from "rehype-autolink-headings";
import type * as unified from "unified";

const autolinkHeadings: unified.Pluggable<RehypeAutolinkHeadingsOptions[]> = [
  rehypeAutolinkHeadings,
  {
    behavior: "append",
    headingProperties: {
      className: "group",
    },
    properties: {
      className: [
        "no-underline group-hover:after:content-['#'] after:text-muted-foreground/30 after:hover:text-muted-foreground ml-1 after:p-1",
      ],
      "aria-hidden": "true",
    },
  },
];

export default autolinkHeadings;
