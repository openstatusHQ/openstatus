"use server";

import { EmailTemplate } from "@/components/templates/email-template";
import { env } from "@/env.mjs";
import { Redis } from "@upstash/redis";
import { Resend } from "resend";

const redis = Redis.fromEnv();

const resend = new Resend(env.RESEND_API_KEY);

export async function addToWaitlist(data: FormData) {
  const email = data.get("email");
  if (email) {
    const number = await write(email);
    await wait(500);
    // TODO: save email to Highstorm

    // REMINDER: how to send emails in server action
    // send(email)
    return number;
  }
  return;
}

// Upstash
const write = async (email) => {
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

// MOCK
const wait = (ms: number): Promise<void> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, ms);
  });
};

// Resend
// const send = async (email) => {
//   return await resend.emails.send({
//     from: "onboarding@openstatus.dev",
//     to: "maximilian@kaske.org",
//     subject: "Hello world",
//     react: EmailTemplate({ firstName: "John" }),
//   });
// };
