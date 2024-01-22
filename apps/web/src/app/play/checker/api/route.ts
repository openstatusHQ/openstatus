import { setCheckerData } from "../[id]/utils";

export const runtime = "edge";

export async function POST(request: Request) {
  const json = await request.json();

  const { url, method } = json;

  try {
    const uuid = await setCheckerData(url, { method });
    return new Response(JSON.stringify({ uuid }));
  } catch (e) {
    console.log(e);
    return new Response("Internal Server Error", { status: 500 });
  }
}
