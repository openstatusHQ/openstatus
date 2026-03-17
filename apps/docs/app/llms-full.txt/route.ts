import { source } from "@/lib/source";
import { NextResponse } from "next/server";

export async function GET() {
  const pages = source.getPages();
  const sections: string[] = [
    "# openstatus docs — Complete Documentation\n",
    "> openstatus is an open-source status page platform with global monitoring (HTTP, TCP, DNS).\n",
  ];

  for (const page of pages) {
    const content = await page.data.getText("raw");
    sections.push(`---\n\n## ${page.data.title}\n\nURL: ${page.url}\n\n${content}\n`);
  }

  return new NextResponse(sections.join("\n"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
