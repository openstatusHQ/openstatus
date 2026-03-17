import { source } from "@/lib/source";
import { llms } from "fumadocs-core/source";
import { NextResponse } from "next/server";

export function GET() {
  const result = llms(source);
  const index = result.index();

  const content = [
    "# openstatus docs — Abridged Documentation\n",
    "> openstatus is an open-source status page platform with global monitoring (HTTP, TCP, DNS).\n",
    index,
  ].join("\n");

  return new NextResponse(content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
