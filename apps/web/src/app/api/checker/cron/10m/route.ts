import { cron } from "../_cron";

export async function GET(req: Request) {
  await cron({ frequency: "10m" });
}
