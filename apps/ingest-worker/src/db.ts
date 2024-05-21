import type { Client as LibsqlClient } from "@libsql/client";
import { createClient } from "@libsql/client";

export const buildLibsqlClient = ({
  url,
  token,
}: {
  url: string;
  token: string;
}): LibsqlClient => {
  return createClient({ url, authToken: token });
};
