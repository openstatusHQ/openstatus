import { regions } from "../regions/vercel";
import type { ParserReturn, Region } from "../types";

export function parseXVercelId(header: string): ParserReturn<Region[]> {
  const regex = /([a-z]{3}[0-9])+:+/g;

  const arr = header.match(regex);
  if (!arr || !arr.length) {
    return { status: "failed", error: new Error("Couldn't parse the header.") };
  }

  const data: Region[] = [];
  for (const r of arr) {
    const regionId = r.replace(/:+/, "");
    const region = regions[regionId];
    if (!region) {
      return {
        status: "failed",
        error: new Error(
          `It seems like the region '${regionId}' is not listed.`,
        ),
      };
    }
    data.push(region);
  }

  return { status: "success", data };
}
