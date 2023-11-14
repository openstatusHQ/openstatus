/**
 * AWS data center informations from 18 regions, supported by vercel.
 * https://vercel.com/docs/concepts/edge-network/regions#region-list
 */
export const vercelRegionsDict = {
  /**
   * A random location will be chosen
   */
  auto: {
    code: "auto",
    name: "random",
    location: "Random",
    flag: "🌍",
  },
  arn1: {
    code: "arn1",
    name: "eu-north-1",
    location: "Stockholm, Sweden",
    flag: "🇸🇪",
  },
  bom1: {
    code: "bom1",
    name: "ap-south-1",
    location: "Mumbai, India",
    flag: "🇮🇳",
  },
  cdg1: {
    code: "cdg1",
    name: "eu-west-3",
    location: "Paris, France",
    flag: "🇫🇷",
  },
  cle1: {
    code: "cle1",
    name: "us-east-2",
    location: "Cleveland, USA",
    flag: "🇺🇸",
  },
  cpt1: {
    code: "cpt1",
    name: "af-south-1",
    location: "Cape Town, South Africa",
    flag: "🇿🇦",
  },
  dub1: {
    code: "dub1",
    name: "eu-west-1",
    location: "Dublin, Ireland",
    flag: "🇮🇪",
  },
  fra1: {
    code: "fra1",
    name: "eu-central-1",
    location: "Frankfurt, Germany",
    flag: "🇩🇪",
  },
  gru1: {
    code: "gru1",
    name: "sa-east-1",
    location: "São Paulo, Brazil",
    flag: "🇧🇷",
  },
  hkg1: {
    code: "hkg1",
    name: "ap-east-1",
    location: "Hong Kong",
    flag: "🇭🇰",
  },
  hnd1: {
    code: "hnd1",
    name: "ap-northeast-1",
    location: "Tokyo, Japan",
    flag: "🇯🇵",
  },
  iad1: {
    code: "iad1",
    name: "us-east-1",
    location: "Washington, D.C., USA",
    flag: "🇺🇸",
  },
  icn1: {
    code: "icn1",
    name: "ap-northeast-2",
    location: "Seoul, South Korea",
    flag: "🇰🇷",
  },
  kix1: {
    code: "kix1",
    name: "ap-northeast-3",
    location: "Osaka, Japan",
    flag: "🇯🇵",
  },
  lhr1: {
    code: "lhr1",
    name: "eu-west-2",
    location: "London, United Kingdom",
    flag: "🇬🇧",
  },
  pdx1: {
    code: "pdx1",
    name: "us-west-2",
    location: "Portland, USA",
    flag: "🇺🇸",
  },
  sfo1: {
    code: "sfo1",
    name: "us-west-1",
    location: "San Francisco, USA",
    flag: "🇺🇸",
  },
  sin1: {
    code: "sin1",
    name: "ap-southeast-1",
    location: "Singapore",
    flag: "🇸🇬",
  },
  syd1: {
    code: "syd1",
    name: "ap-southeast-2",
    location: "Sydney, Australia",
    flag: "🇦🇺",
  },
} as const;

export const flyRegionsDict = {
  ams: {
    code: "ams",
    name: "",
    location: "Amsterdam, Netherlands",
    flag: "🇳🇱",
  },
  iad: {
    code: "iad",
    name: "us-east-1",
    location: "Ashburn, Virginia, USA",
    flag: "🇺🇸",
  },
  jnb: {
    code: "jnb",
    name: "",
    location: "Johannesburg, South Africa",
    flag: "🇿🇦",
  },
  hkg: {
    code: "hkg",
    name: "",
    location: "Hong Kong, Hong Kong",
    flag: "🇭🇰",
  },
  gru: {
    code: "gru",
    name: "",
    location: "Sao Paulo, Brazil",
    flag: "🇧🇷",
  },
  syd: {
    code: "syd",
    name: "",
    location: "Sydney, Australia",
    flag: "🇦🇺",
  },
} as const;

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

export const flyRegions = ["ams", "iad", "hkg", "jnb", "syd", "gru"] as const;

export const regionsDict = { ...vercelRegionsDict, ...flyRegionsDict } as const;
