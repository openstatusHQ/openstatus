import { getApiDocs } from "@/lib/swagger";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const data = await getApiDocs();
  return new Response(JSON.stringify(data), { status: 200 });
}
