import { NextResponse } from "next/server";

import { wait } from "@/lib/utils";

export async function POST() {
  await wait(10_000);
  return NextResponse.json({ message: "Hello, World!" });
}

export async function GET() {
  await wait(10_000);
  return NextResponse.json({ message: "Hello, World!" });
}
