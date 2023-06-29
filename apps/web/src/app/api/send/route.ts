import { NextResponse } from "next/server";
import { EmailTemplate } from "@/components/templates/email-template";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

// TODO: move it into /api/send/[slug]/route.ts
// where slug is the name of the template

export async function POST() {
  try {
    const data = await resend.emails.send({
      from: "onboarding@openstatus.dev",
      to: "maximilian@kaske.org",
      subject: "Hello world",
      react: EmailTemplate({ firstName: "John" }),
    });

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error });
  }
}
