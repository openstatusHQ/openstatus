import { createClient } from "@clickhouse/client-web";

import { env } from "../../env.mjs";

const clickhouseClient = createClient({
  url: env.CLICKHOUSE_URL,
  username: env.CLICKHOUSE_USERNAME,
  password: env.CLICKHOUSE_PASSWORD,
  database: "default",
  /* configuration */
});

export { clickhouseClient };
