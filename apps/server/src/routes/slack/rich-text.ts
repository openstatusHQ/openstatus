/**
 * Slack attaches `rich_text` blocks to every user-typed message. They carry
 * what `message.text` (mrkdwn) loses: emoji codepoints, structured mentions
 * and links, styles. Convert them to the markdown the timeline renders.
 *
 * Structural types instead of `@slack/types`: the package is only a
 * transitive dep and the fields used here are stable.
 */

type Style = {
  bold?: boolean;
  italic?: boolean;
  strike?: boolean;
  code?: boolean;
};

type InlineElement =
  | { type: "text"; text: string; style?: Style }
  | { type: "emoji"; name: string; unicode?: string; style?: Style }
  | { type: "link"; url: string; text?: string; style?: Style }
  | { type: "user"; user_id: string; style?: Style }
  | { type: "channel"; channel_id: string; style?: Style }
  | { type: "usergroup"; usergroup_id: string; style?: Style }
  | { type: "broadcast"; range: string; style?: Style }
  | { type: "date"; fallback?: string; style?: Style }
  | { type: "color"; value: string; style?: Style };

type Section = { type: "rich_text_section"; elements: InlineElement[] };
type List = {
  type: "rich_text_list";
  style: "bullet" | "ordered";
  indent?: number;
  offset?: number;
  elements: Section[];
};
type Quote = { type: "rich_text_quote"; elements: InlineElement[] };
type Preformatted = {
  type: "rich_text_preformatted";
  elements: InlineElement[];
};
type RichTextElement = Section | List | Quote | Preformatted;
type RichTextBlock = { type: "rich_text"; elements: RichTextElement[] };

export type MentionNames = {
  users?: Map<string, string>;
  channels?: Map<string, string>;
  usergroups?: Map<string, string>;
};

// `<@U1|max>`, `<#C1|inc-db>`, `<!subteam^S1|@engineering>` in mrkdwn `text`.
const LABELLED_MENTION = /<([@#]|!subteam\^)([A-Z0-9]+)\|@?([^>|]+)>/g;

/**
 * Names Slack already spelled out in `message.text`. The only source for a
 * user group's handle, since `rich_text` carries just its id and reading
 * groups would need a scope we do not request.
 */
export function mentionLabelsFromText(text: string | undefined): MentionNames {
  const names: Required<MentionNames> = {
    users: new Map(),
    channels: new Map(),
    usergroups: new Map(),
  };
  for (const match of (text ?? "").matchAll(LABELLED_MENTION)) {
    const [, kind, id, label] = match;
    const target =
      kind === "@"
        ? names.users
        : kind === "#"
          ? names.channels
          : names.usergroups;
    target.set(id, label.trim());
  }
  return names;
}

function isRichTextBlock(block: unknown): block is RichTextBlock {
  return (
    typeof block === "object" &&
    block !== null &&
    (block as { type?: unknown }).type === "rich_text" &&
    Array.isArray((block as { elements?: unknown }).elements)
  );
}

function richTextBlocks(blocks: unknown[] | undefined): RichTextBlock[] {
  return (blocks ?? []).filter(isRichTextBlock);
}

/** A list's children are sections; everything else holds inlines directly. */
function inlinesOf(element: RichTextElement): InlineElement[] {
  if (element.type === "rich_text_list") {
    return element.elements.flatMap((item) => item.elements ?? []);
  }
  return element.elements ?? [];
}

/** Every user and channel id mentioned, deduplicated, for the caller to resolve. */
export function collectMentions(blocks: unknown[] | undefined): {
  users: string[];
  channels: string[];
} {
  const users = new Set<string>();
  const channels = new Set<string>();
  for (const block of richTextBlocks(blocks)) {
    for (const element of block.elements) {
      for (const inline of inlinesOf(element)) {
        if (inline.type === "user") users.add(inline.user_id);
        if (inline.type === "channel") channels.add(inline.channel_id);
      }
    }
  }
  return { users: [...users], channels: [...channels] };
}

// Only what remark would otherwise interpret; `#`, `>`, `-` matter at line start.
const INLINE_SPECIALS = /[\\`*_~[\]]/g;
const LINE_START_SPECIALS =
  /^(\s*)(#{1,6}|>|[-+]|-{3,}|={3,}|\d+[.)])(?=\s|$)/gm;

function escapeText(text: string): string {
  return text
    .replace(INLINE_SPECIALS, "\\$&")
    .replace(LINE_START_SPECIALS, "$1\\$2");
}

function longestBacktickRun(text: string): number {
  let max = 0;
  for (const match of text.matchAll(/`+/g)) {
    max = Math.max(max, match[0].length);
  }
  return max;
}

/** A delimiter longer than any backtick run inside, so the span cannot close early. */
function inlineCode(text: string): string {
  const fence = "`".repeat(longestBacktickRun(text) + 1);
  const pad = text.startsWith("`") || text.endsWith("`") ? " " : "";
  return `${fence}${pad}${text}${pad}${fence}`;
}

function codeFence(code: string): string {
  const fence = "`".repeat(Math.max(3, longestBacktickRun(code) + 1));
  return `${fence}\n${code}\n${fence}`;
}

// Not every renderer sanitizes `javascript:`; anything else becomes plain text.
const SAFE_LINK = /^(https?:|mailto:)/i;

/** Spaces and parentheses end a markdown destination early; `<>` break autolinks. */
function linkDestination(url: string): string {
  return url.replace(
    /[ ()<>]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

/** `"1f44d-1f3fc"` → 👍🏼. Hyphen-separated hex codepoints. */
function emojiFromUnicode(unicode: string): string | undefined {
  const points = unicode.split("-").map((hex) => Number.parseInt(hex, 16));
  if (points.length === 0 || points.some((p) => !Number.isFinite(p))) {
    return undefined;
  }
  try {
    return String.fromCodePoint(...points);
  } catch {
    return undefined;
  }
}

/** Markers must hug the text, or remark reads `**bold **` literally. */
function applyStyle(text: string, style: Style | undefined): string {
  if (!style || !text.trim()) return text;
  const leading = text.match(/^\s*/)?.[0] ?? "";
  const trailing = text.match(/\s*$/)?.[0] ?? "";
  let inner = text.slice(leading.length, text.length - trailing.length);
  if (style.code) {
    inner = inlineCode(inner);
  } else {
    if (style.strike) inner = `~~${inner}~~`;
    if (style.italic) inner = `_${inner}_`;
    if (style.bold) inner = `**${inner}**`;
  }
  return `${leading}${inner}${trailing}`;
}

function renderInline(element: InlineElement, names: MentionNames): string {
  switch (element.type) {
    case "text":
      return applyStyle(
        element.style?.code ? element.text : escapeText(element.text),
        element.style,
      );
    case "emoji": {
      const char = element.unicode
        ? emojiFromUnicode(element.unicode)
        : undefined;
      return applyStyle(char ?? `:${element.name}:`, element.style);
    }
    case "link": {
      const label = element.text?.trim();
      if (!SAFE_LINK.test(element.url)) {
        return applyStyle(escapeText(label || element.url), element.style);
      }
      const url = linkDestination(element.url);
      const md =
        label && label !== element.url
          ? `[${escapeText(label)}](${url})`
          : `<${url}>`;
      return applyStyle(md, element.style);
    }
    case "user": {
      const name = names.users?.get(element.user_id);
      return applyStyle(
        `@${escapeText(name ?? element.user_id)}`,
        element.style,
      );
    }
    case "channel": {
      const name = names.channels?.get(element.channel_id);
      return applyStyle(
        `#${escapeText(name ?? element.channel_id)}`,
        element.style,
      );
    }
    case "usergroup": {
      const name = names.usergroups?.get(element.usergroup_id);
      return applyStyle(
        `@${escapeText(name ?? element.usergroup_id)}`,
        element.style,
      );
    }
    case "broadcast":
      return applyStyle(`@${element.range}`, element.style);
    case "date":
      return applyStyle(escapeText(element.fallback ?? ""), element.style);
    case "color":
      return applyStyle(escapeText(element.value), element.style);
    default:
      return "";
  }
}

function renderInlines(elements: InlineElement[], names: MentionNames): string {
  return elements.map((element) => renderInline(element, names)).join("");
}

// Wide enough to nest under `1. ` (3 columns) as well as `- `.
const LIST_INDENT = "    ";

function renderElement(element: RichTextElement, names: MentionNames): string {
  switch (element.type) {
    case "rich_text_section":
      return renderInlines(element.elements, names);
    case "rich_text_list": {
      const pad = LIST_INDENT.repeat(element.indent ?? 0);
      const start = (element.offset ?? 0) + 1;
      return element.elements
        .map((item, index) => {
          const marker =
            element.style === "ordered" ? `${start + index}.` : "-";
          // Continuation lines stay inside the item when indented to its text.
          const hang = `\n${pad}${" ".repeat(marker.length + 1)}`;
          const text = renderInlines(item.elements, names).replace(/\n/g, hang);
          return `${pad}${marker} ${text}`;
        })
        .join("\n");
    }
    case "rich_text_quote":
      return renderInlines(element.elements, names)
        .split("\n")
        .map((line) => `> ${line}`)
        .join("\n");
    case "rich_text_preformatted":
      return codeFence(
        element.elements
          .map((inline) =>
            inline.type === "text"
              ? inline.text
              : inline.type === "link"
                ? (inline.text ?? inline.url)
                : "",
          )
          .join(""),
      );
    default:
      return "";
  }
}

/**
 * Markdown for a message's `rich_text` blocks, or `undefined` when there are
 * none so the caller falls back to `message.text`.
 */
export function richTextToMarkdown(
  blocks: unknown[] | undefined,
  names: MentionNames = {},
): string | undefined {
  const rich = richTextBlocks(blocks);
  if (rich.length === 0) return undefined;
  let out = "";
  let previous: RichTextElement["type"] | undefined;
  for (const block of rich) {
    for (const element of block.elements) {
      const rendered = renderElement(element, names);
      if (!rendered.trim()) continue;
      // Slack emits one list per nesting level; a blank line would split them.
      const adjacentLists =
        previous === "rich_text_list" && element.type === "rich_text_list";
      if (out) out += adjacentLists ? "\n" : "\n\n";
      out += rendered;
      previous = element.type;
    }
  }
  return out.trim() || undefined;
}
