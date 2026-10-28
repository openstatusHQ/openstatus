// What scripts/record-slack.mjs writes to slack.json: the people and channels,
// and every change on screen — messages posted and updated by the real app,
// people typing, reactions, the status modal — in seconds.
export type SlackBlock = {
  type: string;
  block_id?: string;
  text?: { type: string; text: string };
  elements?: SlackElement[];
  fields?: { type: string; text: string }[];
  label?: { type: string; text: string };
  element?: SlackElement;
  optional?: boolean;
  hint?: { type: string; text: string };
};

export type SlackElement = {
  type: string;
  text?: string | { type: string; text: string };
  action_id?: string;
  style?: "primary" | "danger";
  url?: string;
  value?: string;
  placeholder?: { type: string; text: string };
  initial_option?: { text: { type: string; text: string }; value: string };
  initial_value?: string;
};

export type SlackView = {
  title?: { type: string; text: string };
  submit?: { type: string; text: string };
  close?: { type: string; text: string };
  blocks?: SlackBlock[];
  callback_id?: string;
};

export type SlackEvent = { t: number; clock: string } & (
  | {
      op: "post";
      channel: string;
      user: string;
      ts?: string;
      text?: string;
      blocks?: SlackBlock[];
      thread_ts?: string;
    }
  | {
      op: "update";
      channel: string;
      ts: string;
      text?: string;
      blocks?: SlackBlock[];
    }
  | {
      op: "ephemeral";
      channel: string;
      user: string;
      text?: string;
      blocks?: SlackBlock[];
    }
  | { op: "open"; channel: string }
  | { op: "channel"; channel: string; name: string }
  | { op: "topic"; channel: string; topic: string }
  | { op: "archive"; channel: string }
  | { op: "pin"; channel: string; ts: string }
  | { op: "react"; channel: string; ts: string; name: string; user: string }
  | { op: "compose"; channel: string; text: string }
  | { op: "press"; channel?: string; ts?: string; action_id: string }
  | { op: "modal"; view: SlackView }
  | { op: "field"; block_id: string; value: string }
  | { op: "modal_close" }
);

export type SlackPerson = { id: string; name: string; realName: string };

export type SlackData = {
  team: { id: string; name: string; domain: string };
  viewer: string;
  bot: { id: string; name: string };
  people: SlackPerson[];
  channels: { id: string; name: string }[];
  events: SlackEvent[];
};

export type SlackMessage = {
  key: string;
  ts?: string;
  user: string;
  clock: string;
  text: string;
  blocks?: SlackBlock[];
  ephemeral: boolean;
  pinned: boolean;
  reactions: { name: string; users: string[] }[];
  // When it appeared, for a short fade in.
  since: number;
};

export type SlackState = {
  channel: string;
  channels: { id: string; name: string; archived: boolean; since: number }[];
  topics: Record<string, string>;
  messages: Record<string, SlackMessage[]>;
  compose: Record<string, string>;
  modal: {
    view: SlackView;
    fields: Record<string, string>;
    since: number;
  } | null;
  // The button pressed last, and when, to draw it held down for a moment.
  pressed: { action_id: string; ts?: string; t: number } | null;
};

// Everything on screen at `t`: the events up to it, folded in order.
export function stateAt(data: SlackData, t: number): SlackState {
  const state: SlackState = {
    channel: data.channels[0]?.id ?? "",
    channels: data.channels.map((c) => ({ ...c, archived: false, since: -1 })),
    topics: {},
    messages: {},
    compose: {},
    modal: null,
    pressed: null,
  };
  const list = (channel: string) => (state.messages[channel] ??= []);
  const find = (channel: string, ts: string) =>
    list(channel).find((m) => m.ts === ts);
  let n = 0;
  for (const e of data.events) {
    if (e.t > t) break;
    n++;
    switch (e.op) {
      case "open":
        state.channel = e.channel;
        break;
      case "channel":
        state.channels.push({
          id: e.channel,
          name: e.name,
          archived: false,
          since: e.t,
        });
        break;
      case "topic":
        state.topics[e.channel] = e.topic;
        break;
      case "archive": {
        const c = state.channels.find((x) => x.id === e.channel);
        if (c) c.archived = true;
        break;
      }
      case "post":
        // Thread replies stay in their thread, which the video never opens.
        if (e.thread_ts && e.thread_ts !== e.ts) break;
        list(e.channel).push({
          key: e.ts ?? `post-${n}`,
          ts: e.ts,
          user: e.user,
          clock: e.clock,
          text: e.text ?? "",
          blocks: e.blocks,
          ephemeral: false,
          pinned: false,
          reactions: [],
          since: e.t,
        });
        break;
      case "ephemeral":
        list(e.channel).push({
          key: `ephemeral-${n}`,
          user: e.user,
          clock: e.clock,
          text: e.text ?? "",
          blocks: e.blocks,
          ephemeral: true,
          pinned: false,
          reactions: [],
          since: e.t,
        });
        break;
      case "update": {
        const m = find(e.channel, e.ts);
        if (m) Object.assign(m, { text: e.text ?? m.text, blocks: e.blocks });
        break;
      }
      case "pin": {
        const m = find(e.channel, e.ts);
        if (m) m.pinned = true;
        break;
      }
      case "react": {
        const m = find(e.channel, e.ts);
        if (!m) break;
        const r = m.reactions.find((x) => x.name === e.name);
        if (r) r.users.push(e.user);
        else m.reactions.push({ name: e.name, users: [e.user] });
        break;
      }
      case "compose":
        state.compose[e.channel] = e.text;
        break;
      case "press":
        state.pressed = { action_id: e.action_id, ts: e.ts, t: e.t };
        break;
      case "modal":
        state.modal = { view: e.view, fields: {}, since: e.t };
        break;
      case "field":
        if (state.modal) state.modal.fields[e.block_id] = e.value;
        break;
      case "modal_close":
        state.modal = null;
        break;
    }
  }
  return state;
}
