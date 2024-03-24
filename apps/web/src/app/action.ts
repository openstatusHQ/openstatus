"use server";

import { Redis } from "@upstash/redis";
import { Resend } from "resend";

import { WaitingList, validateEmailNotDisposable } from "@openstatus/emails";

import { env } from "@/env";

const redis = Redis.fromEnv();

const resend = new Resend(env.RESEND_API_KEY);

export async function addToWaitlist(data: FormData) {
  const email = data.get("email");
  if (email) {
    const number = await write(String(email));
    // await wait(500);
    // TODO: save email to Highstorm

    // REMINDER: how to send emails in server action
    // send(email)
    return number;
  }
  return;
}

// Upstash
const write = async (email: string) => {
  const key = "waitlist";
  const res = await redis
    .pipeline()
    .zadd(key, {
      score: Date.now(),
      member: email,
    })
    .zcard(key)
    .exec();
  return res[1];
};

// Resend
export const sendWaitingListEmail = async (email: string) => {
  const isValid = await validateEmailNotDisposable(email);
  if (!isValid) {
    await resend.emails.send({
      from: "Thibault Le Ouay Ducasse <thibault@openstatus.dev>",
      to: [email],
      subject: "Thanks for joining the waitlist!",
      react: WaitingList(),
    });
  }
};
