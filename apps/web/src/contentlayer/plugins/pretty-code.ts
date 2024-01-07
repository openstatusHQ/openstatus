import rehypePrettyCode from "rehype-pretty-code";
import type * as unified from "unified";

// props to https://rehype-pretty-code.netlify.app/

// biome-ignore lint/suspicious/noExplicitAny:
const prettyCode: unified.Pluggable<any[]> = [
  rehypePrettyCode,
  {
    theme: "github-light",
    // biome-ignore lint/suspicious/noExplicitAny:
    onVisitLine(node: any) {
      // Prevent lines from collapsing in `display: grid` mode, and
      // allow empty lines to be copy/pasted
      if (node.children.length === 0) {
        node.children = [{ type: "text", value: " " }];
      }
    },
    // biome-ignore lint/suspicious/noExplicitAny:
    onVisitHighlightedLine(node: any) {
      node.properties.className.push("highlighted");
    },
    // biome-ignore lint/suspicious/noExplicitAny:
    onVisitHighlightedWord(node: any) {
      node.properties.className = ["word"];
    },
  },
];

export default prettyCode;
