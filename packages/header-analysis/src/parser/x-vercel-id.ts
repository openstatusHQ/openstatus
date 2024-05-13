import { regions } from "../regions/vercel";
import type { Region } from "../types";

export function parseXVercelId(header: string): Region[] {
  const regex = /([a-z]{3}[0-9])+:+/g;

  const arr = header.match(regex);
  if (!arr) {
    return [];
  }

  return arr.map((r) => {
    const regionId = r.replace(/:+/, "");
    return regions[regionId];
  });
}
