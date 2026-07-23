import type { FormattedMessageData } from "@openstatus/notification-base";

type AdaptiveCardContainerStyle = "attention" | "warning" | "good";
type AdaptiveCardTextColor =
  | "Default"
  | "Dark"
  | "Light"
  | "Accent"
  | "Good"
  | "Warning"
  | "Attention";

type AdaptiveCardTextBlock = {
  type: "TextBlock";
  text: string;
  weight?: "Default" | "Lighter" | "Bolder";
  size?: "Default" | "Small" | "Medium" | "Large" | "ExtraLarge";
  color?: AdaptiveCardTextColor;
  isSubtle?: boolean;
  fontType?: "Default" | "Monospace";
  spacing?: "None" | "Small" | "Default" | "Medium" | "Large";
  horizontalAlignment?: "Left" | "Center" | "Right";
  wrap?: boolean;
};

type AdaptiveCardFact = { title: string; value: string };

type AdaptiveCardFactSet = {
  type: "FactSet";
  facts: AdaptiveCardFact[];
};

type AdaptiveCardContainer = {
  type: "Container";
  style?: AdaptiveCardContainerStyle;
  items: AdaptiveCardBodyElement[];
};

type AdaptiveCardBodyElement =
  | AdaptiveCardTextBlock
  | AdaptiveCardFactSet
  | AdaptiveCardContainer;

type AdaptiveCardOpenUrlAction = {
  type: "Action.OpenUrl";
  title: string;
  url: string;
};

export type AdaptiveCard = {
  type: "AdaptiveCard";
  $schema: "https://adaptivecards.io/schemas/adaptive-card.json";
  version: "1.5";
  body: AdaptiveCardBodyElement[];
  actions: AdaptiveCardOpenUrlAction[];
};

const SCHEMA_URL = "https://adaptivecards.io/schemas/adaptive-card.json";
const CARD_VERSION = "1.5";
const FOOTER_TEXT = "openstatus";

function buildUrlText(data: FormattedMessageData): string {
  if (data.monitorMethod && data.monitorJobType === "http") {
    return `${data.monitorMethod} ${data.monitorUrl}`;
  }
  return data.monitorUrl;
}

function buildHeader(
  data: FormattedMessageData,
  style: AdaptiveCardContainerStyle,
  titleColor: AdaptiveCardTextColor,
  title: string,
): AdaptiveCardContainer {
  return {
    type: "Container",
    style,
    items: [
      {
        type: "TextBlock",
        text: title,
        weight: "Bolder",
        size: "Large",
        color: titleColor,
        wrap: true,
      },
      {
        type: "TextBlock",
        text: buildUrlText(data),
        fontType: "Monospace",
        spacing: "None",
        isSubtle: true,
        wrap: true,
      },
    ],
  };
}

function buildFactSet(data: FormattedMessageData): AdaptiveCardFactSet {
  return {
    type: "FactSet",
    facts: [
      { title: "Status code", value: data.statusCodeFormatted },
      { title: "Regions", value: data.regionsDisplay },
      { title: "Latency", value: data.latencyDisplay },
      { title: "Timestamp", value: data.timestampFormatted },
    ],
  };
}

function buildFooter(): AdaptiveCardTextBlock {
  return {
    type: "TextBlock",
    text: FOOTER_TEXT,
    size: "Small",
    isSubtle: true,
    horizontalAlignment: "Right",
    wrap: false,
  };
}

function buildIncidentDurationBlock(
  label: string,
  duration: string,
): AdaptiveCardTextBlock {
  return {
    type: "TextBlock",
    text: `**${label}:** ${duration}`,
    wrap: true,
    spacing: "Medium",
  };
}

export function buildAlertCard(data: FormattedMessageData): AdaptiveCard {
  const body: AdaptiveCardBodyElement[] = [
    buildHeader(
      data,
      "attention",
      "Attention",
      `${data.monitorName} is failing`,
    ),
    buildFactSet(data),
    {
      type: "Container",
      items: [
        { type: "TextBlock", text: "**Error message**", wrap: true },
        {
          type: "TextBlock",
          text: data.errorMessage,
          fontType: "Monospace",
          wrap: true,
        },
      ],
    },
    buildFooter(),
  ];

  return {
    type: "AdaptiveCard",
    $schema: SCHEMA_URL,
    version: CARD_VERSION,
    body,
    actions: [
      {
        type: "Action.OpenUrl",
        title: "View dashboard",
        url: data.dashboardUrl,
      },
    ],
  };
}

export function buildRecoveryCard(data: FormattedMessageData): AdaptiveCard {
  const body: AdaptiveCardBodyElement[] = [
    buildHeader(data, "good", "Good", `${data.monitorName} is recovered`),
  ];

  if (data.incidentDuration) {
    body.push(buildIncidentDurationBlock("Downtime", data.incidentDuration));
  }

  body.push(buildFactSet(data), buildFooter());

  return {
    type: "AdaptiveCard",
    $schema: SCHEMA_URL,
    version: CARD_VERSION,
    body,
    actions: [
      {
        type: "Action.OpenUrl",
        title: "View dashboard",
        url: data.dashboardUrl,
      },
    ],
  };
}

export function buildDegradedCard(data: FormattedMessageData): AdaptiveCard {
  const body: AdaptiveCardBodyElement[] = [
    buildHeader(data, "warning", "Warning", `${data.monitorName} is degraded`),
  ];

  if (data.incidentDuration) {
    body.push(
      buildIncidentDurationBlock(
        "Previous incident duration",
        data.incidentDuration,
      ),
    );
  }

  body.push(buildFactSet(data), buildFooter());

  return {
    type: "AdaptiveCard",
    $schema: SCHEMA_URL,
    version: CARD_VERSION,
    body,
    actions: [
      {
        type: "Action.OpenUrl",
        title: "View dashboard",
        url: data.dashboardUrl,
      },
    ],
  };
}

export function buildTestCard(): AdaptiveCard {
  return {
    type: "AdaptiveCard",
    $schema: SCHEMA_URL,
    version: CARD_VERSION,
    body: [
      {
        type: "Container",
        style: "good",
        items: [
          {
            type: "TextBlock",
            text: "Test notification",
            weight: "Bolder",
            size: "Large",
            color: "Good",
            wrap: true,
          },
          {
            type: "TextBlock",
            text: "Your Microsoft Teams webhook is configured correctly.",
            spacing: "None",
            isSubtle: true,
            wrap: true,
          },
        ],
      },
      {
        type: "FactSet",
        facts: [
          { title: "Status", value: "Webhook Connected" },
          { title: "Type", value: "Test Notification" },
        ],
      },
      {
        type: "TextBlock",
        text: "You will receive notifications here when your monitors trigger fail, recover, or degrade.",
        wrap: true,
      },
      buildFooter(),
    ],
    actions: [
      {
        type: "Action.OpenUrl",
        title: "View dashboard",
        url: "https://app.openstatus.dev",
      },
    ],
  };
}
