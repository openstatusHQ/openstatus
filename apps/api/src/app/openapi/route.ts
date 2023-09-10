import { getApiDocs } from "@/lib/swagger";

export const dynamic = "force-dynamic";

export async function GET(_: Request) {
  const data = await getApiDocs();
  return new Response(JSON.stringify(data), { status: 200 });
}
