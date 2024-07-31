import rehypePrettyCode from "rehype-pretty-code";
import type * as unified from "unified";

// props to https://rehype-pretty-code.netlify.app/

// biome-ignore lint/suspicious/noExplicitAny: ContentLayer
const prettyCode: unified.Pluggable<any[]> = [
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
    // biome-ignore lint/suspicious/noExplicitAny: ContentLayer
    onVisitHighlightedLine(node: any) {
      node.properties.className.push("highlighted");
    },
    // biome-ignore lint/suspicious/noExplicitAny: ContentLayer
    onVisitHighlightedWord(node: any) {
      node.properties.className = ["word"];
    },
  },
];

export default prettyCode;
