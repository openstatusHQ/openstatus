import { regions } from "../regions/vercel";
import type { ParserReturn, Region } from "../types";

export function parseXVercelId(header: string): ParserReturn<Region[]> {
  const regex = /([a-z]{3}[0-9])+:+/g;

  const arr = header.match(regex);
  if (!arr || !arr.length) {
    return { status: "failed", error: new Error("Couldn't parse the header.") };
  }

  const data = arr.map((r) => {
    const regionId = r.replace(/:+/, "");
    return regions[regionId];
  });

  return { status: "success", data };
}
