import { createClient } from "@clickhouse/client-web";

import { env } from "../../env.mjs";

// This client can only be used in node.js environment

const clickhouseClient = createClient({
  host: env.CLICKHOUSE_URL,
  username: env.CLICKHOUSE_USERNAME,
  password: env.CLICKHOUSE_PASSWORD,
  database: "default",
  /* configuration */
});

export { clickhouseClient };
