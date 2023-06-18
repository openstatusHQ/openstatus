import { EmailTemplate } from "@/components/templates/email-template";
import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST() {
  try {
    const data = await resend.emails.send({
      from: "onboarding@openstatus.dev",
      to: "maximilian@kaske.org",
      subject: "Hello world",
      // @ts-ignore FIXME:
      react: EmailTemplate({ firstName: "John" }),
    });

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error });
  }
}
