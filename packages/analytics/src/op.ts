import { OpenPanel } from "@openpanel/sdk";

const op = new OpenPanel({
  clientId: "YOUR_CLIENT_ID",
  clientSecret: "YOUR_CLIENT_SECRET",
});

op.setGlobalProperties({
  env: process.env.VERCEL_ENV || "localhost",
  // app_version
});

export { op };
