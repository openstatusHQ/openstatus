import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";

export default auth(async (req) => {
  const url = req.nextUrl.clone();

  if (url.pathname.includes("api/trpc")) {
    return NextResponse.next();
  }

  const encodedSearchParams = `${url.pathname}?${url.search}`;

  if (!req.auth && url.pathname !== "/login") {
    const newURL = new URL("/login", req.url);

    if (encodedSearchParams) {
      newURL.searchParams.append("redirectTo", encodedSearchParams);
    }

    return NextResponse.redirect(newURL);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!api|assets|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
