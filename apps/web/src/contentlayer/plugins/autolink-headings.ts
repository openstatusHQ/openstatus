import rehypeAutolinkHeadings from "rehype-autolink-headings";
import type * as unified from "unified";

const autolinkHeadings: unified.Pluggable<any[]> = [
  rehypeAutolinkHeadings,
  {
    behavior: "append",
    properties: {
      className: [
        "no-underline after:content-['#'] after:text-muted-foreground/50 after:hover:text-muted-foreground ml-1 after:p-1",
      ],
      "aria-hidden": "true",
    },
  },
];

export default autolinkHeadings;
