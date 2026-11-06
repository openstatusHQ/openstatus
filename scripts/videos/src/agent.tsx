import type { CSSProperties, ReactNode } from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import {
  agentStateAt,
  inlineRuns,
  type ActivityItem,
  type AgentData,
  type ToolItem,
} from "./agent-data";
import { Mark, palette } from "./brand";
import { stepAt } from "./camera";
import { sourceTime, type Segment } from "./pacing";
import { Caption, CAPTION_FADE, Cursor } from "./scene";
import type { Timeline } from "./timeline";
import { FEED, isTall } from "./update-layout";

// The Claude Desktop window at about 1.35× its real size, so text survives
// being watched at 1080p.
export const AGENT_WIDTH = 1600;
export const AGENT_HEIGHT = 1000;
// In 9:16 the window is the thread alone, narrow enough to be drawn larger.
const AGENT_TALL_WIDTH = 820;
const SIDEBAR = 348;
const COLUMN = 900;
const GUTTER = 30;

// Claude Desktop's light theme tokens. Its typefaces are proprietary, so these
// are the stacks the app itself falls back to.
const ui = {
  bg000: "hsl(0 0% 100%)",
  bg100: "hsl(48 33.3% 97.1%)",
  bg200: "hsl(53 28.6% 94.5%)",
  bg300: "hsl(48 25% 92.2%)",
  bg400: "hsl(50 20.7% 88.6%)",
  text100: "hsl(60 2.6% 7.6%)",
  text300: "hsl(60 2.5% 23.3%)",
  text500: "hsl(51 3.1% 43.7%)",
  border: "hsl(30 3.3% 11.8% / 0.14)",
  brand: "hsl(15 63.1% 59.6%)",
  sans: 'ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  // Charter first: Georgia's old-style figures wobble in a row of metrics.
  serif: 'Charter, ui-serif, Georgia, "Times New Roman", serif',
  mono: '"SF Mono", ui-monospace, Menlo, Consolas, monospace',
};

const FOLD = 0.3;
// The cursor stays on the section this long after opening it.
const REST = 1.2;
const PRESS = 0.25;
// The cursor glides in over this long before the click.
const GLIDE = 0.8;

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ease = (x: number) => x * x * (3 - 2 * x);

function Icon({ d, size = 24 }: { d: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none">
      <path
        d={d}
        stroke="currentColor"
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const icons = {
  plus: "M12 5v14M5 12h14",
  chats:
    "M5 6.5h14a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5H10l-4.5 3v-3H5A1.5 1.5 0 0 1 3.5 16V8A1.5 1.5 0 0 1 5 6.5z",
  projects:
    "M3.5 7.5a2 2 0 0 1 2-2h4l2 2.5h7a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z",
  artifacts: "M12 3l8 4.5v9L12 21l-8-4.5v-9zM4 7.5l8 4.5 8-4.5M12 12v9",
  code: "M9 7l-5 5 5 5M15 7l5 5-5 5",
  sliders: "M4 8h9M17 8h3M4 16h3M11 16h9M15 5.5v5M9 13.5v5",
  sidebar:
    "M4.5 5h15A1.5 1.5 0 0 1 21 6.5v11a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5v-11A1.5 1.5 0 0 1 4.5 5zM9.5 5v14",
  chevron: "M6 9.5l6 6 6-6",
  up: "M12 19V5M6 11l6-6 6 6",
};

function Inline({ text }: { text: string }) {
  return (
    <>
      {inlineRuns(text).map((run, i) =>
        run.style === "bold" ? (
          <span key={i} style={{ fontWeight: 600 }}>
            {run.text}
          </span>
        ) : run.style === "code" ? (
          <span
            key={i}
            style={{
              fontFamily: ui.mono,
              fontSize: "0.82em",
              padding: "1px 6px",
              borderRadius: 6,
              color: "hsl(0 56% 42%)",
              backgroundColor: ui.bg200,
              boxShadow: `0 0 0 1px ${ui.border}`,
            }}
          >
            {run.text}
          </span>
        ) : (
          <span key={i}>{run.text}</span>
        ),
      )}
    </>
  );
}

function Spinner({ t }: { t: number }) {
  return (
    <div
      style={{
        width: 19,
        height: 19,
        borderRadius: 9999,
        border: `2.5px solid ${ui.bg400}`,
        borderTopColor: ui.text500,
        transform: `rotate(${t * 360}deg)`,
      }}
    />
  );
}

function Json({ label, text }: { label: string; text: string }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div
        style={{
          marginBottom: 8,
          fontFamily: ui.sans,
          fontSize: 17,
          color: ui.text500,
        }}
      >
        {label}
      </div>
      <div
        style={{
          maxHeight: 216,
          overflow: "hidden",
          padding: "12px 16px",
          borderRadius: 10,
          fontFamily: ui.mono,
          fontSize: 16.5,
          lineHeight: 1.45,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          color: ui.text300,
          backgroundColor: ui.bg200,
        }}
      >
        {text}
      </div>
    </div>
  );
}

function Button({
  children,
  primary,
  style,
}: {
  children: ReactNode;
  primary?: boolean;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        padding: "10px 20px",
        borderRadius: 10,
        fontFamily: ui.sans,
        fontSize: 20,
        fontWeight: 500,
        color: primary ? ui.bg100 : ui.text100,
        backgroundColor: primary ? ui.text100 : ui.bg000,
        boxShadow: primary ? undefined : `0 0 0 1px ${ui.border}`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Approval({
  item,
  t,
  column,
}: {
  item: ToolItem;
  t: number;
  column: number;
}) {
  const click = item.clickAt ?? Infinity;
  const glide = ease(
    interpolate(
      t,
      [(item.clickAt ?? 0) - GLIDE, item.clickAt ?? 0],
      [0, 1],
      clamp,
    ),
  );
  const pressed = t >= click - 0.05;
  const scale =
    item.clickAt !== null && pressed
      ? interpolate(t, [click, click + PRESS], [0.93, 1], clamp)
      : 1;
  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: 10,
        marginTop: 16,
      }}
    >
      <Button>Deny</Button>
      <Button>Always allow</Button>
      <Button primary style={{ transform: `scale(${scale})` }}>
        Allow once
      </Button>
      {t >= click - GLIDE - 0.2 && (
        <Cursor
          x={interpolate(glide, [0, 1], [column - 470, column - 100])}
          y={interpolate(glide, [0, 1], [-46, 22])}
          zoom={0.45}
          pressed={pressed && t < click + PRESS}
        />
      )}
    </div>
  );
}

// What the app asks before a write; the section stays folded above it.
function ApprovalCard({
  item,
  t,
  column,
}: {
  item: ToolItem;
  t: number;
  column: number;
}) {
  return (
    <div
      style={{
        borderRadius: 14,
        padding: "16px 16px 16px 18px",
        backgroundColor: ui.bg000,
        boxShadow: `0 0 0 1px ${ui.border}, 0 6px 20px -10px rgb(0 0 0 / 0.16)`,
      }}
    >
      <div
        style={{
          marginBottom: 14,
          fontFamily: ui.sans,
          fontSize: 21,
          color: ui.text100,
        }}
      >
        Claude wants to use <span style={{ fontWeight: 600 }}>{item.name}</span>{" "}
        from openstatus
      </div>
      <Json label="Request" text={JSON.stringify(item.input, null, 2)} />
      <Approval item={item} t={t} column={column} />
    </div>
  );
}

function ToolStep({ item, t }: { item: ToolItem; t: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, height: 44 }}>
      <Mark size={20} color={ui.text300} />
      <span style={{ fontFamily: ui.sans, fontSize: 20, color: ui.text100 }}>
        {item.name}
      </span>
      <span
        style={{
          flex: 1,
          fontFamily: ui.sans,
          fontSize: 18,
          color: ui.text500,
        }}
      >
        openstatus
      </span>
      {item.status === "done" ? (
        <span style={{ fontFamily: ui.sans, fontSize: 18, color: ui.text500 }}>
          {item.summary}
        </span>
      ) : (
        <Spinner t={t} />
      )}
    </div>
  );
}

function Activity({
  item,
  t,
  column,
}: {
  item: ActivityItem;
  t: number;
  column: number;
}) {
  const revealAt = item.revealAt;
  const open =
    revealAt === null
      ? 0
      : interpolate(t, [revealAt, revealAt + FOLD], [0, 1], clamp);
  const glide =
    revealAt === null
      ? 0
      : ease(interpolate(t, [revealAt - GLIDE, revealAt], [0, 1], clamp));
  const asking = item.tools.find(
    (tool) =>
      tool.status === "approval" ||
      (tool.allowedAt !== null && t < tool.allowedAt + PRESS),
  );
  // A band of light sweeping the label while it works.
  const sweep = ((t * 0.6) % 1) * 300 - 100;
  return (
    <>
      <div style={{ position: "relative" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            height: 38,
            fontFamily: ui.sans,
            fontSize: 20,
            color: ui.text500,
          }}
        >
          {item.settled ? (
            item.label
          ) : (
            <span
              style={{
                backgroundImage: `linear-gradient(100deg, ${ui.text500} 40%, ${ui.bg400} 50%, ${ui.text500} 60%)`,
                backgroundSize: "300% 100%",
                backgroundPosition: `${-sweep}% 0`,
                backgroundClip: "text",
                WebkitBackgroundClip: "text",
                color: "transparent",
              }}
            >
              Tinkering…
            </span>
          )}
          <div
            style={{ display: "flex", transform: `rotate(${open * 180}deg)` }}
          >
            <Icon d={icons.chevron} size={18} />
          </div>
        </div>
        {revealAt !== null &&
          t >= revealAt - GLIDE - 0.1 &&
          t < revealAt + REST && (
            <Cursor
              x={interpolate(glide, [0, 1], [640, 250])}
              y={interpolate(glide, [0, 1], [110, 22])}
              zoom={0.45}
              pressed={t >= revealAt - 0.05 && t < revealAt + PRESS}
            />
          )}
      </div>
      <div style={{ display: "grid", gridTemplateRows: `${open}fr` }}>
        <div style={{ overflow: "hidden", minHeight: 0, opacity: open }}>
          <div
            style={{
              margin: "2px 0 6px 8px",
              padding: "2px 0 2px 20px",
              borderLeft: `2px solid ${ui.bg400}`,
            }}
          >
            {item.tools.map((tool) => (
              <ToolStep key={tool.id} item={tool} t={t} />
            ))}
          </div>
        </div>
      </div>
      {asking && <ApprovalCard item={asking} t={t} column={column} />}
    </>
  );
}

function Thinking({ t }: { t: number }) {
  return (
    <div style={{ display: "flex", height: 34, alignItems: "center" }}>
      <div
        style={{
          width: 15,
          height: 15,
          borderRadius: 9999,
          backgroundColor: ui.brand,
          transform: `scale(${0.75 + 0.25 * Math.sin(t * 5)})`,
        }}
      />
    </div>
  );
}

function Composer({
  text,
  model,
  t,
}: {
  text: string;
  model: string;
  t: number;
}) {
  const caret = Math.floor(t * 2) % 2 === 0;
  return (
    <div
      style={{
        padding: "18px 16px 14px 22px",
        borderRadius: 24,
        backgroundColor: ui.bg000,
        boxShadow: `0 0 0 1px ${ui.border}, 0 6px 24px -10px rgb(0 0 0 / 0.1)`,
      }}
    >
      <div
        style={{
          minHeight: 34,
          fontFamily: ui.sans,
          fontSize: 22,
          lineHeight: 1.4,
          color: text ? ui.text100 : ui.text500,
        }}
      >
        {text || "Reply to Claude…"}
        {text && (
          <span
            style={{
              display: "inline-block",
              width: 2,
              height: 26,
              marginLeft: 2,
              verticalAlign: "text-bottom",
              backgroundColor: ui.text100,
              opacity: caret ? 1 : 0,
            }}
          />
        )}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginTop: 12,
          color: ui.text300,
        }}
      >
        <Icon d={icons.plus} />
        <Icon d={icons.sliders} />
        <div style={{ flex: 1 }} />
        <span style={{ fontFamily: ui.sans, fontSize: 19 }}>{model}</span>
        <Icon d={icons.chevron} size={18} />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 44,
            height: 44,
            marginLeft: 6,
            borderRadius: 12,
            color: ui.bg000,
            backgroundColor: text ? ui.brand : "hsl(15 63.1% 59.6% / 0.45)",
          }}
        >
          <Icon d={icons.up} />
        </div>
      </div>
    </div>
  );
}

function Lights() {
  return ["#ff5f57", "#febc2e", "#28c840"].map((c) => (
    <div
      key={c}
      style={{
        width: 14,
        height: 14,
        flexShrink: 0,
        borderRadius: 9999,
        backgroundColor: c,
      }}
    />
  ));
}

function Sidebar({ data }: { data: AgentData }) {
  const { client, title } = data;
  const item: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 14,
    height: 46,
    padding: "0 12px",
    borderRadius: 10,
    fontFamily: ui.sans,
    fontSize: 20,
    color: ui.text300,
  };
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: SIDEBAR,
        flexShrink: 0,
        padding: "0 12px 14px",
        backgroundColor: ui.bg200,
        borderRight: `1px solid ${ui.border}`,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 9,
          height: 62,
          padding: "0 8px",
        }}
      >
        <Lights />
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", color: ui.text500 }}>
          <Icon d={icons.sidebar} />
        </div>
      </div>
      <div
        style={{
          padding: "6px 12px 14px",
          fontFamily: ui.serif,
          fontSize: 28,
          color: ui.text100,
        }}
      >
        Claude
      </div>
      <div style={{ ...item, color: ui.text100, fontWeight: 500 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 28,
            height: 28,
            borderRadius: 9999,
            backgroundColor: ui.bg400,
          }}
        >
          <Icon d={icons.plus} size={18} />
        </div>
        New chat
      </div>
      {[
        ["Chats", icons.chats],
        ["Projects", icons.projects],
        ["Artifacts", icons.artifacts],
        ["Code", icons.code],
      ].map(([label, d]) => (
        <div key={label} style={item}>
          <Icon d={d} />
          {label}
        </div>
      ))}
      <div
        style={{
          padding: "22px 12px 8px",
          fontFamily: ui.sans,
          fontSize: 17,
          color: ui.text500,
        }}
      >
        Recents
      </div>
      <div
        style={{
          ...item,
          height: 42,
          color: ui.text100,
          backgroundColor: ui.bg400,
        }}
      >
        {title}
      </div>
      {client.recents.map((recent) => (
        <div key={recent} style={{ ...item, height: 42 }}>
          <span
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {recent}
          </span>
        </div>
      ))}
      <div style={{ flex: 1 }} />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "12px 8px 0",
          borderTop: `1px solid ${ui.border}`,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 38,
            height: 38,
            borderRadius: 9999,
            fontFamily: ui.sans,
            fontSize: 18,
            fontWeight: 500,
            color: ui.bg100,
            backgroundColor: ui.text300,
          }}
        >
          {client.user[0]}
        </div>
        <div style={{ fontFamily: ui.sans, lineHeight: 1.25 }}>
          <div style={{ fontSize: 19, color: ui.text100 }}>{client.user}</div>
          <div style={{ fontSize: 16, color: ui.text500 }}>{client.plan}</div>
        </div>
      </div>
    </div>
  );
}

export function AgentWindow({
  data,
  t,
  style,
  width = AGENT_WIDTH,
  height = AGENT_HEIGHT,
  sidebar = true,
}: {
  data: AgentData;
  t: number;
  style?: CSSProperties;
  width?: number;
  height?: number;
  sidebar?: boolean;
}) {
  const colors = palette.light;
  const state = agentStateAt(data, t);
  const column = Math.min(COLUMN, width - (sidebar ? SIDEBAR : 0) - 2 * GUTTER);
  return (
    <div
      style={{
        display: "flex",
        width,
        height,
        borderRadius: 14,
        overflow: "hidden",
        backgroundColor: ui.bg100,
        boxShadow: `0 0 0 1px ${colors.border}, ${colors.shadow}`,
        ...style,
      }}
    >
      {sidebar && <Sidebar data={data} />}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            height: 62,
            flexShrink: 0,
            padding: "0 22px",
            fontFamily: ui.sans,
            fontSize: 20,
            color: ui.text100,
          }}
        >
          {!sidebar && (
            <div style={{ display: "flex", gap: 9, marginRight: 14 }}>
              <Lights />
            </div>
          )}
          {data.title}
          <div style={{ display: "flex", color: ui.text500 }}>
            <Icon d={icons.chevron} size={18} />
          </div>
          <div style={{ flex: 1 }} />
          <div
            style={{
              padding: "7px 16px",
              borderRadius: 9,
              fontSize: 18,
              boxShadow: `0 0 0 1px ${ui.border}`,
            }}
          >
            Share
          </div>
        </div>
        {/* The outer box pins the bottom once the thread outgrows it; the inner
            min-height keeps a short thread at the top. */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            overflow: "hidden",
            maskImage: "linear-gradient(to bottom, transparent, #000 32px)",
          }}
        >
          <div
            style={{
              flexShrink: 0,
              minHeight: "100%",
              width: column,
              margin: "0 auto",
              padding: "18px 0 20px",
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            {state.items.map((item) =>
              item.kind === "user" ? (
                <div
                  key={item.id}
                  style={{
                    alignSelf: "flex-end",
                    maxWidth: Math.min(680, column - 100),
                    margin: "10px 0",
                    padding: "13px 20px",
                    borderRadius: 18,
                    fontFamily: ui.sans,
                    fontSize: 21,
                    lineHeight: 1.45,
                    color: ui.text100,
                    backgroundColor: ui.bg300,
                  }}
                >
                  {item.text}
                </div>
              ) : item.kind === "text" ? (
                <div
                  key={item.id}
                  style={{
                    margin: "6px 0",
                    fontFamily: ui.serif,
                    fontSize: 23,
                    lineHeight: 1.6,
                    color: ui.text100,
                  }}
                >
                  <Inline text={item.text} />
                </div>
              ) : (
                <Activity key={item.id} item={item} t={t} column={column} />
              ),
            )}
            {state.thinking && <Thinking t={t} />}
          </div>
        </div>
        <div style={{ width: column, flexShrink: 0, margin: "0 auto" }}>
          <Composer text={state.compose} model={data.client.model} t={t} />
          <div
            style={{
              padding: "10px 0 12px",
              textAlign: "center",
              fontFamily: ui.sans,
              fontSize: 15,
              color: ui.text500,
            }}
          >
            Claude can make mistakes. Please double-check responses.
          </div>
        </div>
      </div>
    </div>
  );
}

export function AgentScene({
  timeline,
  agent,
  segments,
}: {
  timeline: Timeline;
  agent: AgentData;
  segments: Segment[];
}) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = sourceTime(segments, frame / fps);
  // In 9:16 the window fills what the title above and the caption below
  // leave of the frame.
  const tall = isTall({ width, height });
  const top = FEED.top + 110;
  const scale = tall
    ? (width * 0.94) / AGENT_TALL_WIDTH
    : Math.min((width * 0.9) / AGENT_WIDTH, (height * 0.84) / AGENT_HEIGHT);
  const size = tall
    ? {
        width: AGENT_TALL_WIDTH,
        height: (height - FEED.bottom - 140 - top) / scale,
      }
    : { width: AGENT_WIDTH, height: AGENT_HEIGHT };
  const step = stepAt(timeline, t);
  return (
    <AbsoluteFill style={{ backgroundColor: palette.light.stage }}>
      <div
        style={{
          position: "absolute",
          left: (width - size.width * scale) / 2,
          top: tall ? top : (height - size.height * scale) / 2 - 24,
          transform: `scale(${scale})`,
          transformOrigin: "0 0",
        }}
      >
        <AgentWindow data={agent} t={t} {...size} sidebar={!tall} />
      </div>
      {step && (
        <Caption
          key={step.t}
          label={step.label}
          opacity={interpolate(t - step.t, [0, CAPTION_FADE], [0, 1], clamp)}
          theme="light"
        />
      )}
    </AbsoluteFill>
  );
}
