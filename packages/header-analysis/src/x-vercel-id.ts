import { z } from "zod";

import { vercelRegions, vercelRegionsDict } from "@openstatus/utils";

interface VercelHitInfo {
  code: string;
  name: string;
  location: string;
  flag: string; // emoji flag
}

const vercelRegionsEnum = z.enum(vercelRegions);

export function parseXVercelId(header: string): VercelHitInfo[] {
  const regex = /([a-z]{3}[0-9])+:+/g;

  const arr = header.match(regex);
  if (!arr) {
    return [];
  }

  return arr.map((r) => {
    const regionId = r.replace(/:+/, "");
    const parsedRegionId = vercelRegionsEnum.parse(regionId);

    return vercelRegionsDict[parsedRegionId];
  });
}
