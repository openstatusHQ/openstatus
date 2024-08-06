import rehypePrettyCode from "rehype-pretty-code";
import type { Options as RehypePrettyCodeOptions } from "rehype-pretty-code";
import type { CharsElement, LineElement } from "rehype-pretty-code";
import type * as unified from "unified";
// props to https://rehype-pretty-code.netlify.app/

const prettyCode: unified.Pluggable<RehypePrettyCodeOptions[]> = [
  rehypePrettyCode,
  {
    theme: {
      dark: "github-dark-dimmed",
      light: "github-light",
    },
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    onVisitLine(node: any) {
      // Prevent lines from collapsing in `display: grid` mode, and
      // allow empty lines to be copy/pasted
      if (node.children.length === 0) {
        node.children = [{ type: "text", value: " " }];
      }
    },
    onVisitHighlightedLine(node: LineElement) {
      node?.properties?.className?.push("highlighted");
    },
    // Changed the method below from onVisitHighlightedWord as it is not available in rehype-pretty-code
    onVisitHighlightedChars(node: CharsElement) {
      node.properties.className = ["word"];
    },
  },
];

export default prettyCode;
