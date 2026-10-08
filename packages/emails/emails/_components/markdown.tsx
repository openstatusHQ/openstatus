/** @jsxRuntime automatic @jsxImportSource react */

import { Marked, Renderer } from "marked";

import { colors, fonts } from "./styles";

// double quotes would end the style attribute these strings are written into
const mono = fonts.mono.replace(/"/g, "'");

const text = `margin:0 0 16px;font-size:15px;line-height:24px;color:${colors.body}`;
const heading = `margin:20px 0 8px;padding:0;font-family:${mono};font-size:12px;line-height:16px;font-weight:400;letter-spacing:0.12em;text-transform:uppercase;color:${colors.faint}`;
const code = `font-family:${mono};font-size:13px;background-color:${colors.subtle}`;

const tagStyles: Record<string, string> = {
  p: text,
  li: `margin:0 0 6px;font-size:15px;line-height:24px;color:${colors.body}`,
  ul: "margin:0 0 16px;padding-left:20px;list-style-type:disc",
  ol: "margin:0 0 16px;padding-left:20px;list-style-type:decimal",
  h1: heading,
  h2: heading,
  h3: heading,
  h4: heading,
  h5: heading,
  h6: heading,
  strong: `font-weight:600;color:${colors.foreground}`,
  hr: `margin:20px 0;border:none;border-top:1px solid ${colors.border}`,
  code,
  pre: `margin:0 0 16px;padding:12px 14px;border-radius:8px;white-space:pre-wrap;word-break:break-word;${code}`,
  table: `width:100%;table-layout:fixed;word-break:break-word;margin:0 0 16px;border-collapse:collapse;font-size:14px;line-height:22px;color:${colors.body}`,
  th: `padding:6px 10px;border:1px solid ${colors.border};background-color:${colors.subtle};font-weight:600;color:${colors.foreground}`,
  td: `padding:6px 10px;border:1px solid ${colors.border}`,
  blockquote: `margin:0 0 16px;padding:0 0 0 14px;border-left:3px solid ${colors.border}`,
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Allowlist, not a blocklist: entity- or case-obfuscated schemes never match.
const SAFE_URL = /^(https?:\/\/|mailto:)/i;

const renderer = new Renderer();
// Subscribers must never receive author-controlled markup.
renderer.html = ({ text, block }) =>
  block ? `<p>${escapeHtml(text.trim())}</p>\n` : escapeHtml(text);
// mail clients strip <input>
renderer.checkbox = ({ checked }) => (checked ? "☑" : "☐");
renderer.link = function ({ href, tokens }) {
  const label = this.parser.parseInline(tokens);
  if (!SAFE_URL.test(href.trim())) return label;
  return `<a href="${escapeHtml(href.trim())}" target="_blank" style="color:${colors.body};text-decoration:underline">${label}</a>`;
};
renderer.image = ({ href, text }) =>
  /^https:\/\//i.test(href.trim())
    ? `<img src="${escapeHtml(href.trim())}" alt="${escapeHtml(text)}" style="max-width:100%;height:auto" />`
    : escapeHtml(text);

const marked = new Marked({ renderer, gfm: true, async: false });

// Safe because every author-written "<" is escaped above: any tag left in the
// output was produced by marked itself.
const STYLED_TAG = new RegExp(
  `<(${Object.keys(tagStyles).join("|")})(\\s[^>]*)?>`,
  "g",
);

export function renderMarkdown(source: string): string {
  const html = marked.parse(source) as string;
  return html.replace(
    STYLED_TAG,
    (_, tag: string, attrs = "") =>
      `<${tag}${attrs} style="${tagStyles[tag]}">`,
  );
}

export function Markdown({ children }: { children: string }) {
  return (
    <div
      style={{ margin: "0 0 24px" }}
      // oxlint-disable-next-line react/no-danger -- renderMarkdown escapes all author HTML
      dangerouslySetInnerHTML={{ __html: renderMarkdown(children) }}
    />
  );
}
