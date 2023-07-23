import { NextResponse } from "next/server";

import { flatten } from "@/lib/flatten";

export async function GET() {
  const res = await fetch("https://jsonplaceholder.typicode.com/todos/1");
  // const res = await fetch("https://google.com");
  const json = res.bodyUsed ? await res.json() : {};
  const flattenedData = flatten({
    headers: res.headers,
    body: json,
  });
  console.log({ flattenedData });
  // console.log(JSON.parse(JSON.stringify(flattenedData)));
  return NextResponse.json({ success: true });
}
