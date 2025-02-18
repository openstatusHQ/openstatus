/**
 * AWS data center informations from 18 regions, supported by vercel.
 * https://vercel.com/docs/concepts/edge-network/regions#region-list
 */

import type { MonitorFlyRegion } from "@openstatus/db/src/schema/constants";

import { base } from "@openstatus/assertions";
import { monitorMethods, monitorStatus } from "@openstatus/db/src/schema";

import { z } from "zod";
// export const vercelRegionsDict = {
//   /**
//    * A random location will be chosen
//    */
//   auto: {
//     code: "auto",
//     name: "random",
//     location: "Random",
//     flag: "🌍",
//   },
//   arn1: {
//     code: "arn1",
//     name: "eu-north-1",
//     location: "Stockholm, Sweden",
//     flag: "🇸🇪",
//   },
//   bom1: {
//     code: "bom1",
//     name: "ap-south-1",
//     location: "Mumbai, India",
//     flag: "🇮🇳",
//   },
//   cdg1: {
//     code: "cdg1",
//     name: "eu-west-3",
//     location: "Paris, France",
//     flag: "🇫🇷",
//   },
//   cle1: {
//     code: "cle1",
//     name: "us-east-2",
//     location: "Cleveland, USA",
//     flag: "🇺🇸",
//   },
//   cpt1: {
//     code: "cpt1",
//     name: "af-south-1",
//     location: "Cape Town, South Africa",
//     flag: "🇿🇦",
//   },
//   dub1: {
//     code: "dub1",
//     name: "eu-west-1",
//     location: "Dublin, Ireland",
//     flag: "🇮🇪",
//   },
//   fra1: {
//     code: "fra1",
//     name: "eu-central-1",
//     location: "Frankfurt, Germany",
//     flag: "🇩🇪",
//   },
//   gru1: {
//     code: "gru1",
//     name: "sa-east-1",
//     location: "São Paulo, Brazil",
//     flag: "🇧🇷",
//   },
//   hkg1: {
//     code: "hkg1",
//     name: "ap-east-1",
//     location: "Hong Kong",
//     flag: "🇭🇰",
//   },
//   hnd1: {
//     code: "hnd1",
//     name: "ap-northeast-1",
//     location: "Tokyo, Japan",
//     flag: "🇯🇵",
//   },
//   iad1: {
//     code: "iad1",
//     name: "us-east-1",
//     location: "Washington, D.C., USA",
//     flag: "🇺🇸",
//   },
//   icn1: {
//     code: "icn1",
//     name: "ap-northeast-2",
//     location: "Seoul, South Korea",
//     flag: "🇰🇷",
//   },
//   kix1: {
//     code: "kix1",
//     name: "ap-northeast-3",
//     location: "Osaka, Japan",
//     flag: "🇯🇵",
//   },
//   lhr1: {
//     code: "lhr1",
//     name: "eu-west-2",
//     location: "London, United Kingdom",
//     flag: "🇬🇧",
//   },
//   pdx1: {
//     code: "pdx1",
//     name: "us-west-2",
//     location: "Portland, USA",
//     flag: "🇺🇸",
//   },
//   sfo1: {
//     code: "sfo1",
//     name: "us-west-1",
//     location: "San Francisco, USA",
//     flag: "🇺🇸",
//   },
//   sin1: {
//     code: "sin1",
//     name: "ap-southeast-1",
//     location: "Singapore",
//     flag: "🇸🇬",
//   },
//   syd1: {
//     code: "syd1",
//     name: "ap-southeast-2",
//     location: "Sydney, Australia",
//     flag: "🇦🇺",
//   },
// } as const;

export type Continent =
  | "Europe"
  | "North America"
  | "South America"
  | "Asia"
  | "Africa"
  | "Oceania";

export type RegionInfo = {
  code: MonitorFlyRegion;
  location: string;
  flag: string;
  continent: Continent;
};

// TODO: we could think of doing the inverse and use "EU" as key
export const continentDict: Record<Continent, { code: string }> = {
  Europe: { code: "EU" },
  "North America": { code: "NA" },
  "South America": { code: "SA" },
  Asia: { code: "AS" },
  Africa: { code: "AF" },
  Oceania: { code: "OC" },
};

export const flyRegionsDict: Record<MonitorFlyRegion, RegionInfo> = {
  ams: {
    code: "ams",
    location: "Amsterdam, Netherlands",
    flag: "🇳🇱",
    continent: "Europe",
  },
  arn: {
    code: "arn",
    location: "Stockholm, Sweden",
    flag: "🇸🇪",
    continent: "Europe",
  },

  atl: {
    code: "atl",
    location: "Atlanta, Georgia, USA",
    flag: "🇺🇸",
    continent: "North America",
  },
  bog: {
    code: "bog",
    location: "Bogotá, Colombia",
    flag: "🇨🇴",
    continent: "South America",
  },
  bom: {
    code: "bom",
    location: "Mumbai, India",
    flag: "🇮🇳",
    continent: "Asia",
  },
  bos: {
    code: "bos",
    location: "Boston, Massachusetts, USA",
    flag: "🇺🇸",
    continent: "North America",
  },
  cdg: {
    code: "cdg",
    location: "Paris, France",
    flag: "🇫🇷",
    continent: "Europe",
  },
  den: {
    code: "den",
    location: "Denver, Colorado, USA",
    flag: "🇺🇸",
    continent: "North America",
  },
  dfw: {
    code: "dfw",
    location: "Dallas, Texas, USA",
    flag: "🇺🇸",
    continent: "North America",
  },
  ewr: {
    code: "ewr",
    location: "Secaucus, New Jersey, USA",
    flag: "🇺🇸",
    continent: "North America",
  },
  eze: {
    code: "eze",
    location: "Ezeiza, Argentina",
    flag: "🇦🇷",
    continent: "South America",
  },
  fra: {
    code: "fra",
    location: "Frankfurt, Germany",
    flag: "🇩🇪",
    continent: "Europe",
  },
  gdl: {
    code: "gdl",
    location: "Guadalajara, Mexico",
    flag: "🇲🇽",
    continent: "North America",
  },
  gig: {
    code: "gig",
    location: "Rio de Janeiro, Brazil",
    flag: "🇧🇷",
    continent: "South America",
  },
  gru: {
    code: "gru",
    location: "Sao Paulo, Brazil",
    flag: "🇧🇷",
    continent: "South America",
  },
  hkg: {
    code: "hkg",
    location: "Hong Kong, Hong Kong",
    flag: "🇭🇰",
    continent: "Asia",
  },
  iad: {
    code: "iad",
    location: "Ashburn, Virginia, USA",
    flag: "🇺🇸",
    continent: "North America",
  },
  jnb: {
    code: "jnb",
    location: "Johannesburg, South Africa",
    flag: "🇿🇦",
    continent: "Africa",
  },
  lax: {
    code: "lax",
    location: "Los Angeles, California, USA",
    flag: "🇺🇸",
    continent: "North America",
  },
  lhr: {
    code: "lhr",
    location: "London, United Kingdom",
    flag: "🇬🇧",
    continent: "Europe",
  },
  mad: {
    code: "mad",
    location: "Madrid, Spain",
    flag: "🇪🇸",
    continent: "Europe",
  },
  mia: {
    code: "mia",
    location: "Miami, Florida, USA",
    flag: "🇺🇸",
    continent: "North America",
  },
  nrt: {
    code: "nrt",
    location: "Tokyo, Japan",
    flag: "🇯🇵",
    continent: "Asia",
  },
  ord: {
    code: "ord",
    location: "Chicago, Illinois, USA",
    flag: "🇺🇸",
    continent: "North America",
  },
  otp: {
    code: "otp",
    location: "Bucharest, Romania",
    flag: "🇷🇴",
    continent: "Europe",
  },
  phx: {
    code: "phx",
    location: "Phoenix, Arizona, USA",
    flag: "🇺🇸",
    continent: "North America",
  },
  qro: {
    code: "qro",
    location: "Querétaro, Mexico",
    flag: "🇲🇽",
    continent: "North America",
  },
  scl: {
    code: "scl",
    location: "Santiago, Chile",
    flag: "🇨🇱",
    continent: "South America",
  },
  sjc: {
    code: "sjc",
    location: "San Jose, California, USA",
    flag: "🇺🇸",
    continent: "North America",
  },
  sea: {
    code: "sea",
    location: "Seattle, Washington, USA",
    flag: "🇺🇸",
    continent: "North America",
  },
  sin: {
    code: "sin",
    location: "Singapore, Singapore",
    flag: "🇸🇬",
    continent: "Asia",
  },
  syd: {
    code: "syd",
    location: "Sydney, Australia",
    flag: "🇦🇺",
    continent: "Oceania",
  },
  waw: {
    code: "waw",
    location: "Warsaw, Poland",
    flag: "🇵🇱",
    continent: "Europe",
  },
  yul: {
    code: "yul",
    location: "Montreal, Canada",
    flag: "🇨🇦",
    continent: "North America",
  },
  yyz: {
    code: "yyz",
    location: "Toronto, Canada",
    flag: "🇨🇦",
    continent: "North America",
  },
} as const;

// const r = t.flatMap((u) => u[1].continent);

export const groupByContinent = Object.entries(flyRegionsDict).reduce<
  Record<
    | "Europe"
    | "North America"
    | "South America"
    | "Asia"
    | "Africa"
    | "Oceania",
    {
      code: MonitorFlyRegion;
      location: string;
      flag: string;
      continent:
        | "Europe"
        | "North America"
        | "South America"
        | "Asia"
        | "Africa"
        | "Oceania";
    }[]
  >
>(
  (acc, [_key, value]) => {
    Object.assign(acc, {
      [value.continent]: [...acc[value.continent], value],
    });
    return acc;
  },
  {
    "North America": [],
    Europe: [],
    "South America": [],
    Oceania: [],
    Asia: [],
    Africa: [],
  },
);

export const vercelRegions = [
  "arn1",
  "bom1",
  "cdg1",
  "cle1",
  "cpt1",
  "dub1",
  "fra1",
  "gru1",
  "hkg1",
  "hnd1",
  "iad1",
  "icn1",
  "kix1",
  "lhr1",
  "pdx1",
  "sfo1",
  "sin1",
  "syd1",
] as const;

// export const availableRegions = [...vercelRegions, ...flyRegions] as const;

// export const regionsDict = { ...vercelRegionsDict, ...flyRegionsDict } as const;

export const httpPayloadSchema = z.object({
  workspaceId: z.string(),
  monitorId: z.string(),
  method: z.enum(monitorMethods),
  body: z.string().optional(),
  headers: z.array(z.object({ key: z.string(), value: z.string() })).optional(),
  url: z.string(),
  cronTimestamp: z.number(),
  status: z.enum(monitorStatus),
  assertions: z.array(base).nullable(),
  timeout: z.number().default(45000),
  degradedAfter: z.number().nullable(),
  trigger: z.enum(["cron", "api"]).optional().nullable().default("cron"),
  otelConfig: z
    .object({
      endpoint: z.string(),
      headers: z.record(z.string()),
    })
    .optional(),
});

export type HttpPayload = z.infer<typeof httpPayloadSchema>;

export const tpcPayloadSchema = z.object({
  status: z.enum(monitorStatus),
  workspaceId: z.string(),
  uri: z.string(),
  monitorId: z.string(),
  assertions: z.array(base).nullable(),
  cronTimestamp: z.number(),
  timeout: z.number().default(45000),
  degradedAfter: z.number().nullable(),
  trigger: z.enum(["cron", "api"]).optional().nullable().default("cron"),
  otelConfig: z
    .object({
      endpoint: z.string(),
      headers: z.record(z.string()),
    })
    .optional(),
});

export type TcpPayload = z.infer<typeof tpcPayloadSchema>;

export function transformHeaders(headers: { key: string; value: string }[]) {
  return headers.length > 0
    ? headers.reduce(
        (acc, curr) => {
          acc[curr.key] = curr.value;
          return acc;
        },
        {} as Record<string, string>,
      )
    : {};
}
