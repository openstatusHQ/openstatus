import { connect } from "@planetscale/database";
import { drizzle } from "drizzle-orm/planetscale-serverless";

import { env } from "../env.mjs";
import * as schema from "./schema";

const config = {
  url: env.DATABASE_URL,
};

const connection = connect(config);

export const db = drizzle(connection, { schema });
