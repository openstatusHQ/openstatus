import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { keySchema } from "./lib/schema";

export async function middleware(request: NextRequest) {
  const auth = request.headers.get("x-openstatus-key");

  if (!auth) {
    return new Response("Unauthorized", { status: 401 });
  }

  const newHeaders = new Headers(request.headers);

  if (process.env.NODE_ENV === "production") {
    const res = await fetch("https://api.unkey.dev/v1/keys/verify", {
      method: "POST",
      headers: new Headers({
        "Content-Type": "application/json",
      }),
      body: JSON.stringify({ key: auth }),
    });

    const json = await res.json();
    const key = keySchema.safeParse(json);

    if (!key.success) {
      return new Response("Bad Request", { status: 400 });
    }

    if (!key.data.valid) {
      return new Response("Unauthorized", { status: 401 });
    }

    newHeaders.set("x-workspace-id", key.data.ownerId);
  } else {
    // REMINDER: change the id to your workspace id
    newHeaders.set("x-workspace-id", "1");
  }

  return NextResponse.next({ request: { headers: newHeaders } });
}

export const config = { matcher: ["/v1/(.*)"] };
