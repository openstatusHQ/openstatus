import { regions } from "../regions/fly";
import type { ParserReturn, Region } from "../types";

export function parseFlyRequestId(header: string): ParserReturn<Region> {
  const regex = /\b([a-z]{3})\b/g;
  const arr = header.match(regex);

  if (!arr || arr.length === 0) {
    return { status: "failed", error: new Error("Couldn't parse the header.") };
  }

  const region = regions[arr[0]];
  if (region) return { status: "success", data: region };

  return {
    status: "failed",
    error: new Error(
      `It seems like the data center '${arr[0]}' (iata) is not listed.`,
    ),
  };
}
