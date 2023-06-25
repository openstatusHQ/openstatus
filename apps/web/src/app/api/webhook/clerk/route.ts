import { env } from "@/env.mjs";
import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { createTRPCContext } from "@openstatus/api";
import { lambdaRouter } from "@openstatus/api/src/lambda";
import { clerkEvent } from "@openstatus/api/src/router/clerk";

export const config = {
  api: {
    bodyParser: false,
  },
};

export async function POST(req: NextRequest) {
  const wh = new Webhook(env.CLERK_WEBHOOK_SECRET);
  const msg = wh.verify(await req.text(), req.headers as any);

  const r = clerkEvent.safeParse(msg);

  if (!r.success) {
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }

  const ctx = createTRPCContext({ req });
  const caller = lambdaRouter.createCaller(ctx);
  switch (r.data.type) {
    case "user.created":
      await caller.clerkRouter.webhooks.userCreated({ data: r.data });
      break;
    default:
      break;
  }
}
