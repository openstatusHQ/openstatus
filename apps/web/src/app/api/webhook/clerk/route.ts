import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { createTRPCContext } from "@openstatus/api";
import { lambdaRouter } from "@openstatus/api/src/lambda";
import { clerkEvent } from "@openstatus/api/src/router/clerk/type";

// import { clerkEvent } from "@openstatus/api/src/router/clerk";

// export const config = {
//   api: {
//     bodyParser: false,
//   },
// };

export async function POST(req: NextRequest) {
  // Get witch headers is missing
  // const wh = new Webhook(env.CLERK_WEBHOOK_SECRET);
  // const msg = wh.verify(JSON.stringify(await req.json()), req.headers as any);
  const json = await req.json();
  const r = clerkEvent.safeParse(json);
  if (!r.success) {
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }

  const ctx = createTRPCContext({ req });
  const caller = lambdaRouter.createCaller(ctx);
  const event = r.data.type;
  switch (event) {
    case "user.created":
      await caller.clerkRouter.webhooks.userCreated({ data: r.data });
      break;
    case "user.updated":
    case "user.deleted":
      break;

    case "session.created":
      await caller.clerkRouter.webhooks.userSignedIn({ data: r.data });
      break;
    case "session.revoked":
    case "session.removed":
    case "session.ended":
      break;

    case "organization.created":
    case "organizationMembership.created":
      break;

    default:
      ((d: never) => console.error(`${d} not handled here`))(event);
      break;
  }
  return NextResponse.json({ success: true });
}
