import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const auth = request.headers.get("x-api-key");
  // check if api key is ok

  return NextResponse.next();
}
