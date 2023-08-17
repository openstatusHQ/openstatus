import rehypePrettyCode from "rehype-pretty-code";
import type * as unified from "unified";

const prettyCode: unified.Pluggable<any[]> = [
  rehypePrettyCode,
  {
    // prepacked themes
    // https://github.com/shikijs/shiki/blob/main/docs/themes.md
    theme: "github-light",

    // https://stackoverflow.com/questions/76549262/onvisithighlightedline-cannot-push-classname-using-rehype-pretty-code
    // FIXME: maybe properly type this
    onVisitLine(node: any) {
      // Prevent lines from collapsing in `display: grid` mode, and
      // allow empty lines to be copy/pasted
      if (node.children.length === 0) {
        node.children = [{ type: "text", value: " " }];
      }
      node.properties.className = ["line"]; // add 'line' class to each line in the code block
    },

    // FIXME: maybe properly type this
    onVisitHighlightedLine(node: any) {
      node.properties.className?.push("line--highlighted");
    },
  },
];

export default prettyCode;
