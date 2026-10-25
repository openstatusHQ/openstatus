import type { CSSProperties, ReactNode } from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import { Mark, palette } from "./brand";
import { stepAt } from "./camera";
import { fonts } from "./fonts";
import { sourceTime, type Segment } from "./pacing";
import { Caption, CAPTION_FADE } from "./scene";
import {
  stateAt,
  type SlackBlock,
  type SlackData,
  type SlackElement,
  type SlackMessage,
  type SlackState,
} from "./slack-data";
import { emoji, Markdown, Mrkdwn, type Names } from "./slack-text";
import type { Timeline } from "./timeline";

// A Slack-style client at a fixed size; the scene scales it to the stage.
export const SLACK_WIDTH = 1600;
export const SLACK_HEIGHT = 1000;
const AUBERGINE = "#3f0e40";
const INK = "#1d1c1d";
const MUTED = "#616061";
const PRIMARY = "#007a5a";
const AVATAR_COLORS = ["#e8912d", "#2bac76", "#1d9bd1", "#e01e5a"];

const text = (t?: string | { text: string }) =>
  typeof t === "string" ? t : (t?.text ?? "");

// "10:06" → "10:06 AM"
function clockLabel(clock: string) {
  const [h, m] = clock.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

function Avatar({ data, user }: { data: SlackData; user: string }) {
  const size = 36;
  const box: CSSProperties = {
    width: size,
    height: size,
    borderRadius: 6,
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };
  if (user === data.bot.id)
    return (
      <div style={{ ...box, backgroundColor: "#111" }}>
        <Mark size={24} color="#fff" />
      </div>
    );
  const i = data.people.findIndex((p) => p.id === user);
  const person = data.people[i];
  const initials = (person?.realName ?? user)
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("");
  return (
    <div
      style={{
        ...box,
        backgroundColor: AVATAR_COLORS[Math.max(i, 0) % AVATAR_COLORS.length],
        color: "#fff",
        fontFamily: fonts.sans,
        fontWeight: 500,
        fontSize: 14,
      }}
    >
      {initials}
    </div>
  );
}

function Button({
  element,
  pressed,
}: {
  element: SlackElement;
  pressed: boolean;
}) {
  const style = element.style;
  return (
    <div
      style={{
        padding: "0 12px",
        height: 32,
        display: "flex",
        alignItems: "center",
        borderRadius: 4,
        fontWeight: 700,
        fontSize: 14,
        border:
          style === "primary"
            ? `1px solid ${PRIMARY}`
            : style === "danger"
              ? "1px solid #e01e5a"
              : "1px solid rgb(29 28 29 / 0.3)",
        color:
          style === "primary" ? "#fff" : style === "danger" ? "#e01e5a" : INK,
        backgroundColor:
          style === "primary"
            ? pressed
              ? "#00553f"
              : PRIMARY
            : pressed
              ? "#ececec"
              : "#fff",
        transform: pressed ? "scale(0.96)" : undefined,
      }}
    >
      {text(element.text)}
    </div>
  );
}

function Blocks({
  blocks,
  names,
  isPressed,
}: {
  blocks: SlackBlock[];
  names: Names;
  isPressed: (actionId?: string) => boolean;
}) {
  return (
    <div
      style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 2 }}
    >
      {blocks.map((b, i) => {
        switch (b.type) {
          case "header":
            return (
              <div key={i} style={{ fontWeight: 900, fontSize: 18 }}>
                {text(b.text)}
              </div>
            );
          case "section":
            return (
              <div key={i}>
                {b.text &&
                  (b.text.type === "mrkdwn" ? (
                    <Mrkdwn text={b.text.text} names={names} />
                  ) : (
                    b.text.text
                  ))}
                {b.fields && (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 6,
                    }}
                  >
                    {b.fields.map((f, j) => (
                      <div key={j}>
                        <Mrkdwn text={f.text} names={names} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          case "markdown": {
            // Unlike the other blocks, markdown carries its text as a string.
            const raw = (b as { text?: unknown }).text;
            return (
              <div key={i}>
                <Markdown
                  text={typeof raw === "string" ? raw : text(b.text)}
                  names={names}
                />
              </div>
            );
          }
          case "context":
            return (
              <div
                key={i}
                style={{ fontSize: 13, color: MUTED, display: "flex", gap: 6 }}
              >
                {(b.elements ?? []).map((e, j) =>
                  e.type === "mrkdwn" ? (
                    <span key={j}>
                      <Mrkdwn text={text(e.text)} names={names} />
                    </span>
                  ) : e.type === "plain_text" ? (
                    <span key={j}>{text(e.text)}</span>
                  ) : null,
                )}
              </div>
            );
          case "actions":
            return (
              <div key={i} style={{ display: "flex", gap: 8, marginTop: 4 }}>
                {(b.elements ?? [])
                  .filter((e) => e.type === "button")
                  .map((e, j) => (
                    <Button
                      key={j}
                      element={e}
                      pressed={isPressed(e.action_id)}
                    />
                  ))}
              </div>
            );
          case "divider":
            return (
              <div key={i} style={{ height: 1, backgroundColor: "#dddddd" }} />
            );
          default:
            return null;
        }
      })}
    </div>
  );
}

function Message({
  data,
  message,
  previous,
  names,
  state,
  t,
}: {
  data: SlackData;
  message: SlackMessage;
  previous?: SlackMessage;
  names: Names;
  state: SlackState;
  t: number;
}) {
  const isBot = message.user === data.bot.id;
  const author = isBot
    ? data.bot.name
    : (data.people.find((p) => p.id === message.user)?.realName ??
      message.user);
  // Slack folds a run of messages from one person in the same minute.
  const compact =
    previous &&
    !previous.ephemeral &&
    !message.ephemeral &&
    !message.pinned &&
    previous.user === message.user &&
    previous.clock === message.clock;
  const fade = interpolate(t - message.since, [0, 0.25], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const isPressed = (actionId?: string) =>
    Boolean(
      state.pressed &&
      actionId &&
      state.pressed.action_id === actionId &&
      (!state.pressed.ts || state.pressed.ts === message.ts) &&
      t - state.pressed.t < 0.4,
    );
  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        padding: compact ? "2px 20px" : "8px 20px",
        opacity: fade,
        transform: `translateY(${(1 - fade) * 6}px)`,
        backgroundColor: message.pinned ? "#fef9ec" : undefined,
      }}
    >
      <div style={{ width: 36, flexShrink: 0 }}>
        {!compact && <Avatar data={data} user={message.user} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {message.pinned && (
          <div style={{ fontSize: 12.5, color: MUTED, marginBottom: 2 }}>
            {emoji("pushpin")} Pinned by {data.bot.name}
          </div>
        )}
        {!compact && (
          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <span style={{ fontWeight: 900, fontSize: 15 }}>{author}</span>
            {isBot && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: MUTED,
                  backgroundColor: "rgb(29 28 29 / 0.13)",
                  borderRadius: 2,
                  padding: "1px 3px",
                }}
              >
                APP
              </span>
            )}
            <span style={{ fontSize: 12, color: MUTED }}>
              {clockLabel(message.clock)}
            </span>
          </div>
        )}
        {message.ephemeral && (
          <div style={{ fontSize: 12.5, color: MUTED }}>
            Only visible to you
          </div>
        )}
        {message.blocks?.length ? (
          <Blocks blocks={message.blocks} names={names} isPressed={isPressed} />
        ) : (
          <Mrkdwn text={message.text} names={names} />
        )}
        {message.reactions.length > 0 && (
          <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
            {message.reactions.map((r) => (
              <div
                key={r.name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  height: 24,
                  padding: "0 7px",
                  borderRadius: 12,
                  fontSize: 12,
                  border: "1px solid #1d9bd1",
                  backgroundColor: "rgb(29 155 209 / 0.1)",
                  color: "#1264a3",
                }}
              >
                <span style={{ fontSize: 14 }}>{emoji(r.name)}</span>
                {r.users.length}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Sidebar({
  data,
  state,
  t,
}: {
  data: SlackData;
  state: SlackState;
  t: number;
}) {
  const item = (active: boolean): CSSProperties => ({
    height: 28,
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "0 16px",
    margin: "0 8px",
    borderRadius: 6,
    color: active ? "#fff" : "rgb(255 255 255 / 0.72)",
    backgroundColor: active ? "#1164a3" : undefined,
    fontSize: 15,
  });
  const section = (label: string) => (
    <div style={{ ...item(false), marginTop: 10 }}>▾ {label}</div>
  );
  return (
    <div
      style={{
        width: 260,
        flexShrink: 0,
        backgroundColor: AUBERGINE,
        borderRight: "1px solid rgb(255 255 255 / 0.1)",
        paddingTop: 14,
      }}
    >
      <div
        style={{
          color: "#fff",
          fontWeight: 900,
          fontSize: 18,
          padding: "0 24px 14px",
        }}
      >
        {data.team.name}
      </div>
      <div style={item(false)}>🧵 Threads</div>
      <div style={item(false)}>💬 Huddles</div>
      <div style={item(false)}>✈️ Drafts &amp; sent</div>
      {section("Channels")}
      {state.channels.map((c) => {
        const appear =
          c.since < 0
            ? 1
            : interpolate(t - c.since, [0, 0.3], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });
        return (
          <div
            key={c.id}
            style={{
              ...item(c.id === state.channel),
              opacity: appear * (c.archived ? 0.5 : 1),
              fontWeight:
                c.since >= 0 && c.id !== state.channel ? 700 : undefined,
              whiteSpace: "nowrap",
              overflow: "hidden",
            }}
          >
            <span style={{ opacity: 0.8 }}>#</span>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
              {c.name}
            </span>
          </div>
        );
      })}
      {section("Direct messages")}
      {data.people.map((p) => (
        <div key={p.id} style={item(false)}>
          {p.realName}
        </div>
      ))}
      {section("Apps")}
      <div style={item(false)}>{data.bot.name}</div>
    </div>
  );
}

function Modal({
  state,
  names,
  t,
}: {
  state: SlackState;
  names: Names;
  t: number;
}) {
  if (!state.modal) return null;
  const { view, fields, since } = state.modal;
  const appear = interpolate(t - since, [0, 0.2], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const pressedSubmit =
    state.pressed?.action_id === "submit" && t - state.pressed.t < 0.4;
  const control = (b: SlackBlock): ReactNode => {
    const el = b.element;
    if (!el) return null;
    const value = fields[b.block_id ?? ""];
    const box: CSSProperties = {
      border: "1px solid rgb(29 28 29 / 0.3)",
      borderRadius: 4,
      padding: "8px 12px",
      fontSize: 15,
      minHeight: 20,
    };
    if (el.type === "plain_text_input")
      return (
        <div style={{ ...box, minHeight: 64, color: value ? INK : MUTED }}>
          {value ?? text(el.placeholder)}
          {value !== undefined && (
            <span style={{ borderLeft: `2px solid ${INK}`, marginLeft: 1 }} />
          )}
        </div>
      );
    return (
      <div style={{ ...box, display: "flex", justifyContent: "space-between" }}>
        <span>
          {value ?? text(el.initial_option?.text) ?? text(el.placeholder)}
        </span>
        <span style={{ color: MUTED }}>▾</span>
      </div>
    );
  };
  return (
    <AbsoluteFill
      style={{
        backgroundColor: `rgb(0 0 0 / ${0.45 * appear})`,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: 600,
          backgroundColor: "#fff",
          borderRadius: 8,
          boxShadow: "0 18px 48px rgb(0 0 0 / 0.35)",
          opacity: appear,
          transform: `scale(${0.96 + 0.04 * appear})`,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: "20px 28px",
            fontWeight: 900,
            fontSize: 22,
          }}
        >
          {text(view.title)}
          <span style={{ color: MUTED, fontWeight: 400 }}>✕</span>
        </div>
        <div
          style={{
            padding: "0 28px 8px",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          {(view.blocks ?? []).map((b, i) =>
            b.type === "input" ? (
              <div key={i}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>
                  {text(b.label)}
                  {b.optional && (
                    <span style={{ color: MUTED, fontWeight: 400 }}>
                      {" "}
                      (optional)
                    </span>
                  )}
                </div>
                {control(b)}
                {b.hint && (
                  <div style={{ fontSize: 13, color: MUTED, marginTop: 4 }}>
                    {text(b.hint)}
                  </div>
                )}
              </div>
            ) : b.type === "section" && b.text ? (
              <div key={i}>
                <Mrkdwn text={b.text.text} names={names} />
              </div>
            ) : b.type === "context" ? (
              <div key={i} style={{ fontSize: 13, color: MUTED }}>
                {(b.elements ?? []).map((e, j) => (
                  <Mrkdwn key={j} text={text(e.text)} names={names} />
                ))}
              </div>
            ) : null,
          )}
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 10,
            padding: "16px 28px 20px",
            borderTop: "1px solid #dddddd",
            marginTop: 12,
          }}
        >
          <Button
            element={{ type: "button", text: text(view.close) || "Cancel" }}
            pressed={false}
          />
          <Button
            element={{
              type: "button",
              text: text(view.submit) || "Submit",
              style: "primary",
            }}
            pressed={pressedSubmit}
          />
        </div>
      </div>
    </AbsoluteFill>
  );
}

// The client at `t`, drawn from the recorded events.
export function SlackWindow({
  data,
  t,
  style,
}: {
  data: SlackData;
  t: number;
  style?: CSSProperties;
}) {
  const state = stateAt(data, t);
  const channelName = (id: string) =>
    state.channels.find((c) => c.id === id)?.name ?? id;
  const names: Names = {
    user: (id) =>
      id === data.bot.id
        ? data.bot.name
        : (data.people.find((p) => p.id === id)?.realName ?? id),
    channel: channelName,
  };
  const messages = state.messages[state.channel] ?? [];
  const pinned = messages.filter((m) => m.pinned).length;
  const topic = state.topics[state.channel];
  const compose = state.compose[state.channel] ?? "";
  return (
    <div
      style={{
        width: SLACK_WIDTH,
        height: SLACK_HEIGHT,
        borderRadius: 14,
        overflow: "hidden",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#fff",
        boxShadow: `0 0 0 1px ${palette.light.border}, ${palette.light.shadow}`,
        fontFamily: fonts.sans,
        color: INK,
        fontSize: 15,
        lineHeight: 1.46,
        ...style,
      }}
    >
      <div
        style={{
          height: 44,
          flexShrink: 0,
          backgroundColor: "#350d36",
          display: "flex",
          alignItems: "center",
          padding: "0 16px",
          gap: 8,
          position: "relative",
        }}
      >
        {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
          <div
            key={c}
            style={{
              width: 12,
              height: 12,
              borderRadius: 9999,
              backgroundColor: c,
            }}
          />
        ))}
        <div
          style={{
            position: "absolute",
            left: "50%",
            transform: "translateX(-50%)",
            width: 620,
            height: 26,
            borderRadius: 6,
            backgroundColor: "rgb(255 255 255 / 0.2)",
            color: "rgb(255 255 255 / 0.8)",
            fontSize: 13,
            display: "flex",
            alignItems: "center",
            padding: "0 10px",
          }}
        >
          Search {data.team.name}
        </div>
      </div>
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        <Sidebar data={data} state={state} t={t} />
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            minWidth: 0,
          }}
        >
          <div style={{ borderBottom: "1px solid #dddddd", padding: "0 20px" }}>
            <div
              style={{
                height: 50,
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <span style={{ fontWeight: 900, fontSize: 18 }}>
                # {channelName(state.channel)}
              </span>
              {pinned > 0 && (
                <span
                  style={{
                    fontSize: 12.5,
                    color: MUTED,
                    border: "1px solid #dddddd",
                    borderRadius: 4,
                    padding: "1px 6px",
                  }}
                >
                  {emoji("pushpin")} {pinned} pinned
                </span>
              )}
            </div>
            {topic && (
              <div
                style={{
                  fontSize: 13,
                  color: MUTED,
                  paddingBottom: 10,
                  marginTop: -6,
                }}
              >
                <Mrkdwn text={topic} names={names} />
              </div>
            )}
          </div>
          <div
            style={{
              flex: 1,
              minHeight: 0,
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-end",
              paddingBottom: 8,
            }}
          >
            {messages.map((m, i) => (
              <Message
                key={m.key}
                data={data}
                message={m}
                previous={messages[i - 1]}
                names={names}
                state={state}
                t={t}
              />
            ))}
          </div>
          <div
            style={{
              margin: "0 20px 20px",
              border: "1px solid rgb(29 28 29 / 0.3)",
              borderRadius: 8,
              minHeight: 76,
              padding: "12px 14px",
              color: compose ? INK : MUTED,
            }}
          >
            {compose || `Message #${channelName(state.channel)}`}
            {compose && (
              <span style={{ borderLeft: `2px solid ${INK}`, marginLeft: 1 }} />
            )}
          </div>
        </div>
      </div>
      <Modal state={state} names={names} t={t} />
    </div>
  );
}

// The recorded thread in the client on the stage, paced like the others.
export function SlackScene({
  timeline,
  slack,
  segments,
}: {
  timeline: Timeline;
  slack: SlackData;
  segments: Segment[];
}) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = sourceTime(segments, frame / fps);
  const scale = Math.min(
    (width * 0.9) / SLACK_WIDTH,
    (height * 0.84) / SLACK_HEIGHT,
  );
  const step = stepAt(timeline, t);
  return (
    <AbsoluteFill style={{ backgroundColor: palette.light.stage }}>
      <div
        style={{
          position: "absolute",
          left: (width - SLACK_WIDTH * scale) / 2,
          top: (height - SLACK_HEIGHT * scale) / 2 - 24,
          transform: `scale(${scale})`,
          transformOrigin: "0 0",
        }}
      >
        <SlackWindow data={slack} t={t} />
      </div>
      {step && (
        <Caption
          key={step.t}
          label={step.label}
          opacity={interpolate(t - step.t, [0, CAPTION_FADE], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })}
          theme="light"
        />
      )}
    </AbsoluteFill>
  );
}
