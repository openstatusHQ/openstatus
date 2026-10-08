/**
 * The model writes standard markdown (`**bold**`, `[text](url)`, `### head`)
 * even when told to use Slack mrkdwn, and Slack renders those literally.
 * Convert its free-text replies before posting.
 */

const CODE_SPAN = /```[\s\S]*?```|`[^`\n]+`/g;
const LINK = /!?\[([^\]]*)\]\(\s*<?([^)\s]+)>?(?:\s+"[^"]*")?\s*\)/g;
const BOLD_ITALIC = /\*\*\*(?=\S)([\s\S]*?\S)\*\*\*/g;
const BOLD = /(?:\*\*|__)(?=\S)([\s\S]*?\S)(?:\*\*|__)/g;
const STRIKETHROUGH = /~~(?=\S)([\s\S]*?\S)~~/g;
const HEADING = /^ {0,3}#{1,6}[ \t]+(.+?)[ \t]*#*$/gm;
const BULLET = /^([ \t]*)[-*+][ \t]+/gm;

/** `|` would terminate a `<url|label>` link, so swap it for a lookalike. */
function linkLabel(text: string): string {
  return text.replace(/\|/g, "❘");
}

function convert(text: string): string {
  return text
    .replace(LINK, (_match, label: string, url: string) =>
      label.trim() ? `<${url}|${linkLabel(label.trim())}>` : `<${url}>`,
    )
    .replace(BOLD_ITALIC, "*_$1_*")
    .replace(BOLD, "*$1*")
    .replace(STRIKETHROUGH, "~$1~")
    .replace(HEADING, "*$1*")
    .replace(BULLET, "$1• ");
}

/** Convert markdown in an agent reply to Slack mrkdwn, leaving code spans untouched. */
export function toMrkdwn(text: string): string {
  if (!text) return text;

  let out = "";
  let cursor = 0;
  for (const match of text.matchAll(CODE_SPAN)) {
    out += convert(text.slice(cursor, match.index)) + match[0];
    cursor = match.index + match[0].length;
  }
  return out + convert(text.slice(cursor));
}
