// markdownify
import { marked } from "marked";
export const markdownify = (content: string, div?: boolean) => {
  return div ? marked.parse(content) : marked.parseInline(content);
};

// plainLabel using regex to remove icon patterns
export const plainLabel = (content: string) => {
  return content.replace(/\[.*?\]/g, "").trim();
}

// get icon from label
export const getIconFromLabel = (content: string) => {
  const match = content.match(/\[(.*?)\]/)?.[1]
  return match ? match : null;
}