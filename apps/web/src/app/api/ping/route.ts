import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export const maxDuration = 25; // to trick and not using the same function as the other ping route

export async function GET() {
  return NextResponse.json({ ping: "pong" }, { status: 200 });
}

export async function POST(req: Request) {
  const body = await req.json();
  return NextResponse.json({ ping: body }, { status: 200 });
}
