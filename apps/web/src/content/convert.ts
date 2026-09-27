import { customers, getCustomer } from "../data/customers";
import type { MDXData } from "./utils";
import { formatDate } from "./utils";

/**
 * Converts MDX content to clean markdown format for AI tools
 * Handles YAML frontmatter generation and component serialization
 */
export function convertMdxToMarkdown(data: MDXData): string {
  let output = "";

  // Step 0: Generate YAML frontmatter from metadata
  const { metadata, content } = data;

  output += "---\n";
  output += `title: "${metadata.title}"\n`;
  if (metadata.publishedAt) {
    output += `date: ${formatDate(metadata.publishedAt)}\n`;
  }
  if (metadata.author) {
    output += `author: "${metadata.author}"\n`;
  }
  if (metadata.description) {
    output += `description: "${metadata.description}"\n`;
  }
  if (metadata.category) {
    output += `category: "${metadata.category}"\n`;
  }
  if (metadata.image) {
    output += `image: "${metadata.image}"\n`;
  }
  output += "---\n\n";

  // Step 1: Strip import statements (confirmed: always at top of file)
  let markdown = content.replace(/^import\s+.*$/gm, "");

  // Step 2: Convert <ButtonLink> to markdown links
  markdown = markdown.replace(
    /<ButtonLink\s+href="([^"]*)"[^>]*>([\s\S]*?)<\/ButtonLink>/g,
    (_match, href, children) => {
      // Extract plain text from children (remove any nested tags)
      const text = children.replace(/<[^>]*>/g, "").trim();
      return `[${text}](${href})`;
    },
  );

  // Step 3: Convert <Image> to markdown images
  // Handle with alt attribute
  markdown = markdown.replace(
    /<Image\s+(?:[^>]*\s+)?src="([^"]*)"(?:[^>]*\s+)?alt="([^"]*)"[^>]*\/?>/g,
    (_match, src, alt) => {
      return `![${alt}](${src})`;
    },
  );
  // Handle without alt attribute
  markdown = markdown.replace(
    /<Image\s+(?:[^>]*\s+)?src="([^"]*)"[^>]*\/?>/g,
    (_match, src) => {
      return `![](${src})`;
    },
  );

  // Step 4: Replace <Table> components with a note to use GFM tables
  // TODO: Convert Table components in MDX source files to GFM tables
  markdown = markdown.replace(/<Table\s+data=\{[\s\S]*?\}\s*\/>/g, () => {
    return "<!-- Table: Please convert to GFM markdown table format for better AI tool support -->";
  });

  // Step 5: Convert <Details> to native HTML <details>/<summary> (always closed)
  markdown = markdown.replace(
    /<Details\s+summary="([^"]*)"[^>]*>([\s\S]*?)<\/Details>/g,
    (_match, summary, content) => {
      return `<details>\n  <summary>${summary}</summary>\n  ${content.trim()}\n</details>`;
    },
  );

  // Step 6: Replace interactive components with HTML comments
  markdown = markdown.replace(
    /<StatusPageExample[^>]*(?:\/>|>[\s\S]*?<\/StatusPageExample>)/g,
    "<!-- StatusPageExample omitted -->",
  );
  markdown = markdown.replace(
    /<SimpleChart[^>]*(?:\/>|>[\s\S]*?<\/SimpleChart>)/g,
    "<!-- SimpleChart omitted -->",
  );

  // Step 7: Convert <Aside> to a blockquote callout
  const asideLabels: Record<string, string> = {
    note: "Note",
    tip: "Tip",
    caution: "Caution",
    danger: "Danger",
  };
  markdown = markdown.replace(
    /<Aside\b([^>]*)>([\s\S]*?)<\/Aside>/g,
    (_match, attrs, content) => {
      const type = attrs.match(/type="([^"]*)"/)?.[1] ?? "note";
      const label =
        attrs.match(/title="([^"]*)"/)?.[1] ?? asideLabels[type] ?? "Note";
      const lines = [`**${label}**`, "", ...content.trim().split("\n")];
      return lines.map((line) => (line ? `> ${line}` : ">")).join("\n");
    },
  );

  // Step 8: Convert <ShowcaseYouTube entries={[...]}> to a list of links
  markdown = markdown.replace(/<ShowcaseYouTube\b[\s\S]*?\/>/g, (match) => {
    const items: string[] = [];
    for (const entry of match.matchAll(/\{[^{}]*href:[^{}]*\}/g)) {
      const href = entry[0].match(/href:\s*['"]([^'"]+)['"]/)?.[1];
      const title = entry[0].match(/title:\s*['"]([^'"]+)['"]/)?.[1];
      if (href) items.push(`- [${title ?? "YouTube video"}](${href})`);
    }
    return items.join("\n");
  });

  // Step 9: Convert card components (unwrap grid, then serialize each card)
  markdown = markdown.replace(
    /<CardGrid[^>]*>([\s\S]*?)<\/CardGrid>/g,
    (_match, content) => content,
  );
  markdown = markdown.replace(
    /<Card\b([^>]*)>([\s\S]*?)<\/Card>/g,
    (_match, attrs, content) => {
      const title = attrs.match(/title="([^"]*)"/)?.[1];
      const body = content.trim();
      return title ? `**${title}**\n\n${body}` : body;
    },
  );
  markdown = markdown.replace(/<LinkCard\b([^>]*?)\/>/g, (_match, attrs) => {
    const title = attrs.match(/title="([^"]*)"/)?.[1] ?? "";
    const href = attrs.match(/href="([^"]*)"/)?.[1] ?? "";
    const description = attrs.match(/description="([^"]*)"/)?.[1];
    const link = `[${title}](${href})`;
    return description ? `- ${link} — ${description}` : `- ${link}`;
  });

  // Step 9b: LogoCloud and Quote take their copy from `data/customers.ts`.
  markdown = markdown.replace(/<LogoCloud\b([^>]*?)\/>/g, (_match, attrs) => {
    const limit = Number(attrs.match(/limit=\{(\d+)\}/)?.[1]) || 8;
    return customers
      .slice(0, limit)
      .map((c) => `[${c.name}](${c.story ?? c.href})`)
      .join(", ");
  });
  markdown = markdown.replace(
    /<Quote\s+customer="([^"]*)"[^>]*\/>/g,
    (_match, name) => {
      const customer = getCustomer(name);
      const { quote } = customer;
      if (!quote) return "";
      const link = customer.story
        ? `[Read the story](${customer.story})`
        : `[${customer.name}](${customer.href})`;
      return `> “${quote.text}”\n>\n> — ${quote.name}, ${quote.role} · ${link}`;
    },
  );

  // Step 10: Unwrap layout-only wrappers. Their children are real copy
  // (CTA links, pricing caveats, quote attributions), only the styling goes.
  markdown = markdown.replace(
    /<Actions\b[^>]*>([\s\S]*?)<\/Actions>/g,
    (_match, content: string) =>
      content
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .join("\n\n"),
  );
  // Eyebrow is a visual label with no meaning out of context, so it goes.
  markdown = markdown.replace(/<Eyebrow\b[^>]*>[\s\S]*?<\/Eyebrow>/g, "");
  // SrOnly is a demo's text alternative: hidden on the page, plain copy here.
  // One pass skips wrappers nested inside a match, so repeat until stable.
  const wrapper = /<(Grid|Subtle|p|SrOnly)\b[^>]*>([\s\S]*?)<\/\1>/g;
  while (wrapper.test(markdown)) {
    markdown = markdown.replace(wrapper, (_match, _tag, content) => content);
  }

  markdown = markdown.replace(/<br\s*\/?>|<\/br>/g, "");

  // Step 11: Strip generic HTML containers but extract their text
  // This handles div, span, section, article
  markdown = markdown.replace(
    /<(div|span|section|article)(?:\s+[^>]*)?>[\s\S]*?<\/\1>/g,
    (match) => {
      // Extract text content (remove all tags); blank lines keep adjacent
      // containers from merging into one paragraph.
      return `\n\n${match.replace(/<[^>]*>/g, " ").trim()}\n\n`;
    },
  );

  // Step 12: Strip remaining unknown JSX components. Self-closing tags go
  // first: a `<Demo type="x" />` left for the paired rule reads as an opening
  // tag and swallows everything up to the next closing tag of any component.
  markdown = markdown.replace(/<[A-Z]\w*(?:\s[^>]*?)?\/>/g, "");
  markdown = markdown.replace(/<([A-Z]\w*)\b[^>]*>[\s\S]*?<\/\1>/g, "");

  // A tag removed mid-cell leaves a line holding one space; empty it so it collapses.
  markdown = markdown.replace(/^[ \t]+$/gm, "");
  // Clean up: Remove excessive blank lines (more than 2 consecutive)
  markdown = markdown.replace(/\n{3,}/g, "\n\n");

  // Trim whitespace
  markdown = markdown.trim();

  output += markdown;
  return output;
}
