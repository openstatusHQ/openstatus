import { convertMdxToMarkdown } from "@/content/convert";
import { resolveContent } from "@/content/resolve";
import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs"; // Need fs access for content loading

/**
 * GET handler for markdown content negotiation
 * Serves clean markdown when Accept: text/markdown header is present
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  try {
    // Extract pathname from catch-all params
    const { path: pathSegments } = await params;
    const pathname = pathSegments ? `/${pathSegments.join("/")}` : "/";

    // Resolve content (MDX or listing)
    const result = resolveContent(pathname);

    if (!result) {
      return new NextResponse("Not Found", { status: 404 });
    }

    let markdown: string;
    let contentSource: string;

    // Handle based on content type
    if (result.type === "mdx") {
      // Convert MDX to markdown with metadata for frontmatter
      markdown = convertMdxToMarkdown(result.data);
      contentSource = "mdx";
    } else {
      // Use pre-generated listing
      markdown = result.data;
      contentSource = "listing";
    }

    // Return with appropriate headers
    return new NextResponse(markdown, {
      status: 200,
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Cache-Control":
          "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400",
        "X-Content-Source": contentSource,
      },
    });
  } catch (error) {
    console.error("Error serving markdown:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

// Only allow GET requests
export async function POST() {
  return new NextResponse("Method Not Allowed", { status: 405 });
}

export async function PUT() {
  return new NextResponse("Method Not Allowed", { status: 405 });
}

export async function DELETE() {
  return new NextResponse("Method Not Allowed", { status: 405 });
}
