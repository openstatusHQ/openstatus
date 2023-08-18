import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req:Request) {
  req.headers.set('OpenStatus-Ping',true)
  return NextResponse.json({ ping: "pong" }, { status: 200 });
}
