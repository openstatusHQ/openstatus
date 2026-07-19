import { type NextRequest, NextResponse } from "next/server";

import { convertMdxToMarkdown } from "../../../../content/convert";
import {
  generateStatusDetailMarkdown,
  generateStatusIndexMarkdown,
} from "../../../../content/status-markdown";
import { resolveContent } from "../../../../content/utils/resolve";

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

    const statusMd = await resolveStatusMarkdown(pathSegments);
    if (statusMd != null) {
      return new NextResponse(statusMd, {
        status: 200,
        headers: {
          "Content-Type": "text/markdown; charset=utf-8",
          "Cache-Control":
            "public, max-age=60, s-maxage=60, stale-while-revalidate=300",
          "X-Content-Source": "status",
        },
      });
    }

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

async function resolveStatusMarkdown(
  pathSegments: string[] | undefined,
): Promise<string | null> {
  if (!pathSegments || pathSegments.length === 0) return null;
  if (pathSegments[0] !== "status") return null;
  if (pathSegments.length === 1) {
    return generateStatusIndexMarkdown();
  }
  if (pathSegments.length === 2) {
    const slug = pathSegments[1];
    if (!slug) return null;
    return generateStatusDetailMarkdown(slug);
  }
  return null;
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
