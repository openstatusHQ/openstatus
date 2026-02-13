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
    /<Tweet[^>]*(?:\/>|>[\s\S]*?<\/Tweet>)/g,
    "<!-- Tweet omitted -->",
  );
  markdown = markdown.replace(
    /<StatusPageExample[^>]*(?:\/>|>[\s\S]*?<\/StatusPageExample>)/g,
    "<!-- StatusPageExample omitted -->",
  );
  markdown = markdown.replace(
    /<SimpleChart[^>]*(?:\/>|>[\s\S]*?<\/SimpleChart>)/g,
    "<!-- SimpleChart omitted -->",
  );

  // Step 7: Extract text from <Grid> containers (remove Grid wrapper, keep content)
  markdown = markdown.replace(
    /<Grid[^>]*>([\s\S]*?)<\/Grid>/g,
    (_match, content) => {
      return content;
    },
  );

  // Step 8: Strip generic HTML containers but extract their text
  // This handles div, span, section, article
  markdown = markdown.replace(
    /<(div|span|section|article)(?:\s+[^>]*)?>[\s\S]*?<\/\1>/g,
    (match) => {
      // Extract text content (remove all tags)
      return match.replace(/<[^>]*>/g, " ").trim();
    },
  );

  // Step 9: Strip remaining unknown JSX components
  // Handle paired tags
  markdown = markdown.replace(/<[A-Z]\w*[^>]*>[\s\S]*?<\/[A-Z]\w*>/g, "");
  // Handle self-closing tags
  markdown = markdown.replace(/<[A-Z]\w*\s*\/>/g, "");

  // Clean up: Remove excessive blank lines (more than 2 consecutive)
  markdown = markdown.replace(/\n{3,}/g, "\n\n");

  // Trim whitespace
  markdown = markdown.trim();

  output += markdown;
  return output;
}
