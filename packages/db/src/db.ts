// db.ts
import { drizzle } from "drizzle-orm/planetscale-serverless";

import { connect } from "@planetscale/database";
import { env } from "../env.mjs";

const config = {
  url: env.DATABASE_URL,
};

const connection = connect(config);

export const db = drizzle(connection);
