export const alertInboxProcessingStatus = ["pending", "settled"] as const;

export const alertInboxOutcome = ["processed", "ignored", "invalid"] as const;

export type AlertInboxProcessingStatus =
  (typeof alertInboxProcessingStatus)[number];
export type AlertInboxOutcome = (typeof alertInboxOutcome)[number];
