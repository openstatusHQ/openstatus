"use server";

import { sendTest as sendOpsGenieAlert } from "@openstatus/notification-opsgenie";

import { sendTest as sendPagerDutyAlert } from "@openstatus/notification-pagerduty";

import { sendTest as sendNtfyAlert } from "@openstatus/notification-ntfy";

import { sendTest as sendWebhookAlert } from "@openstatus/notification-webhook";

export async function sendOpsGenieTestAlert(
  apiKey: string,
  region: "us" | "eu",
) {
  const isSuccessfull = await sendOpsGenieAlert({ apiKey, region });
  return isSuccessfull;
}

export async function sendPagerDutyTestAlert(integrationKey: string) {
  const isSuccessfull = await sendPagerDutyAlert({
    integrationKey: integrationKey,
  });
  return isSuccessfull;
}

export async function sendNtfyTestAlert({
  topic,
  serverUrl,
  token,
}: {
  topic: string;
  serverUrl?: string;
  token?: string;
}) {
  const isSuccessfull = await sendNtfyAlert({ topic, serverUrl, token });
  return isSuccessfull;
}

export async function sendWebhookTestAlert({
  url,
  headers,
}: {
  url: string;
  headers?: { key: string; value: string }[];
}) {
  const isSuccessfull = await sendWebhookAlert({ url, headers });
  return isSuccessfull;
}
