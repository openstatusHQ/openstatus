import { cron } from "../_cron";

export const runtime = "edge";
export const preferredRegion = ["auto"];
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  await cron({ frequency: "10m" });
}
