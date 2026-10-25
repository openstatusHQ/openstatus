import type { ReactNode } from "react";

import { fonts } from "./fonts";

// The few emoji codes the app and the script use; others stay as text.
const EMOJI: Record<string, string> = {
  rotating_light: "🚨",
  white_check_mark: "✅",
  pushpin: "📌",
  eyes: "👀",
  warning: "⚠️",
  x: "❌",
  tada: "🎉",
  fire: "🔥",
  memo: "📝",
  link: "🔗",
  bell: "🔔",
  mag: "🔍",
  red_circle: "🔴",
  large_green_circle: "🟢",
  large_yellow_circle: "🟡",
  large_orange_circle: "🟠",
  page_facing_up: "📄",
  information_source: "ℹ️",
  grimacing: "😬",
  dart: "🎯",
  mega: "📣",
  hourglass: "⏳",
  no_entry_sign: "🚫",
  stop: "🛑",
  face_holding_back_tears: "🥹",
  thread: "🧵",
};
export const emoji = (name: string) => EMOJI[name] ?? `:${name}:`;

export type Names = {
  user: (id: string) => string;
  channel: (id: string) => string;
};

export const LINK = "#1264a3";

const decode = (s: string) =>
  s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

const INLINE =
  /(<[^>\n]+>)|(`[^`\n]+`)|(\*[^*\n]+\*)|(_[^_\n]+_)|(~[^~\n]+~)|(:[a-z][a-z0-9_+-]*:)/g;

// Slack's mrkdwn on one line: links, mentions, code, bold, italic, emoji.
function inline(text: string, names: Names, key = ""): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(INLINE)) {
    if (m.index > last) out.push(decode(text.slice(last, m.index)));
    const token = m[0];
    const k = `${key}${i++}`;
    if (m[1]) {
      const [target, label] = token.slice(1, -1).split("|");
      if (target.startsWith("@"))
        out.push(
          <span
            key={k}
            style={{
              color: LINK,
              backgroundColor: "rgb(29 155 209 / 0.1)",
              borderRadius: 3,
              padding: "0 2px",
            }}
          >
            @{names.user(target.slice(1))}
          </span>,
        );
      else if (target.startsWith("#"))
        out.push(
          <span key={k} style={{ color: LINK }}>
            #{label ?? names.channel(target.slice(1))}
          </span>,
        );
      else if (target.startsWith("!"))
        out.push(
          <span key={k} style={{ color: LINK }}>
            @{target.slice(1)}
          </span>,
        );
      else
        out.push(
          <span key={k} style={{ color: LINK }}>
            {decode(label ?? target)}
          </span>,
        );
    } else if (m[2])
      out.push(
        <code
          key={k}
          style={{
            fontFamily: fonts.mono,
            fontSize: "0.86em",
            color: "#e01e5a",
            backgroundColor: "rgb(0 0 0 / 0.04)",
            border: "1px solid rgb(0 0 0 / 0.1)",
            borderRadius: 3,
            padding: "0 3px",
          }}
        >
          {decode(token.slice(1, -1))}
        </code>,
      );
    else if (m[3])
      out.push(
        <b key={k} style={{ fontWeight: 700 }}>
          {inline(token.slice(1, -1), names, `${k}.`)}
        </b>,
      );
    else if (m[4])
      out.push(<i key={k}>{inline(token.slice(1, -1), names, `${k}.`)}</i>);
    else if (m[5])
      out.push(<s key={k}>{inline(token.slice(1, -1), names, `${k}.`)}</s>);
    else out.push(emoji(token.slice(1, -1)));
    last = m.index + token.length;
  }
  if (last < text.length) out.push(decode(text.slice(last)));
  return out;
}

// A mrkdwn text object: lines, with ">" lines drawn as a quote.
export function Mrkdwn({ text, names }: { text: string; names: Names }) {
  const lines = text.split("\n");
  return (
    <>
      {lines.map((line, i) => {
        const quote = /^(&gt;|>)\s?/.exec(line);
        const body = quote ? line.slice(quote[0].length) : line;
        return (
          <div
            key={i}
            style={
              quote
                ? {
                    borderLeft: "4px solid #dddddd",
                    paddingLeft: 12,
                    color: "#454245",
                  }
                : undefined
            }
          >
            {body ? inline(body, names, `${i}.`) : " "}
          </div>
        );
      })}
    </>
  );
}

// The `markdown` block: headings, lists, checklists, bold and code.
export function Markdown({ text, names }: { text: string; names: Names }) {
  const md = (s: string) =>
    s.replace(/\*\*([^*]+)\*\*/g, "*$1*").replace(/__([^_]+)__/g, "*$1*");
  return (
    <>
      {text.split("\n").map((line, i) => {
        const heading = /^(#{1,6})\s+(.*)$/.exec(line);
        if (heading)
          return (
            <div key={i} style={{ fontWeight: 700, marginTop: i ? 8 : 0 }}>
              {inline(md(heading[2]), names, `${i}.`)}
            </div>
          );
        const item = /^\s*[-*]\s+(\[( |x)\]\s+)?(.*)$/.exec(line);
        if (item)
          return (
            <div key={i} style={{ display: "flex", gap: 8, paddingLeft: 8 }}>
              <span>{item[1] ? (item[2] === "x" ? "☑" : "☐") : "•"}</span>
              <span>{inline(md(item[3]), names, `${i}.`)}</span>
            </div>
          );
        return (
          <div key={i}>{line ? inline(md(line), names, `${i}.`) : " "}</div>
        );
      })}
    </>
  );
}
