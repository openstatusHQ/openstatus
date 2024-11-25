import { headers } from "next/headers";

export function getPathnamePrefix() {
  const headersList = headers();
  const host = headersList.get("host");
  const prefix = host?.split(".")[0] === "app" ? "" : "/app";

  return prefix;
}
