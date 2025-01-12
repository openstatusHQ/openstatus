"use server";

import { sendTest } from "@openstatus/notification-opsgenie";

export async function sendOpsGenieTestAlert(
  apiKey: string,
  region: "us" | "eu"
) {
  const isSuccessfull = await sendTest({ apiKey, region });
  return isSuccessfull;
}
