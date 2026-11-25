// Anonymised from a real incident: a table rename in staging dropped the app
// role's access. The outage began the evening before it was declared, the bot
// was added by hand to a channel another workflow created, and links and
// queries were dropped in the channel as the team debugged.

export type FixtureMessage = {
  user: string;
  text: string;
  ts: string;
  bot_id?: string;
  thread_ts?: string;
};

export const FIXTURE_TEAM_ID = "T_PROBO";
export const FIXTURE_CHANNEL_ID = "C0PRODEMERGENCY";
export const FIXTURE_BOT_USER_ID = "UBOT";
export const FIXTURE_USERS = {
  responder: "U_RESPONDER",
  workflowOwner: "U_WORKFLOW_OWNER",
  engineer: "U_ENGINEER",
} as const;

/** 2026-10-15 21:10 UTC: the first error, the evening before the declare. */
export const FIXTURE_STARTED_TS = "1792098600.000100";
/** 2026-10-16 08:30 UTC: the bot is mentioned for the first time. */
export const FIXTURE_MENTION_TS = "1792139400.000200";

const { responder, workflowOwner, engineer } = FIXTURE_USERS;

/** Oldest first, as the conversation reads. */
const conversation: FixtureMessage[] = [
  {
    user: engineer,
    text: "Seeing 500s on the dashboard API since the deploy, anyone else?",
    ts: FIXTURE_STARTED_TS,
  },
  {
    user: workflowOwner,
    text: ":rotating_light: Production Emergency opened by workflow. Owner: <@U_RESPONDER>",
    ts: "1792099200.000100",
  },
  {
    user: engineer,
    text: "Grafana: https://grafana.example.com/d/api-errors?from=1792098000000",
    ts: "1792099800.000100",
  },
  { user: responder, text: "lol same", ts: "1792100100.000100" },
  {
    user: responder,
    text: "```SELECT grantee, privilege_type FROM information_schema.role_table_grants WHERE table_name = 'accounts';```\nempty for app_user",
    ts: "1792138800.000100",
  },
  {
    user: responder,
    text: "Found it: the table rename in staging dropped the grants for app_user.",
    ts: "1792139100.000100",
  },
];

/** Slack's `conversations.history` order: newest first. */
export const busyChannelHistory: FixtureMessage[] = [...conversation].reverse();

/** A link to the first error, as pasted in the channel. */
export const firstErrorPermalink = `https://probo.slack.com/archives/${FIXTURE_CHANNEL_ID}/p${FIXTURE_STARTED_TS.replace(".", "")}`;

export const mentionOutsideThread: FixtureMessage = {
  user: responder,
  text: `<@${FIXTURE_BOT_USER_ID}> the problem started here ${firstErrorPermalink}, can you open a status report?`,
  ts: FIXTURE_MENTION_TS,
};

/** Asked after only a status report was created, with no managed incident. */
export const whatIsTheIncident: FixtureMessage = {
  user: responder,
  text: `<@${FIXTURE_BOT_USER_ID}> what's the incident?`,
  ts: "1792139700.000200",
  thread_ts: FIXTURE_MENTION_TS,
};
