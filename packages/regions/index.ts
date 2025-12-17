export const FLY_REGIONS = [
  "ams",
  "arn",
  "atl",
  "bog",
  "bom",
  "bos",
  "cdg",
  "den",
  "dfw",
  "ewr",
  "eze",
  "fra",
  "gdl",
  "gig",
  "gru",
  "hkg",
  "iad",
  "jnb",
  "lax",
  "lhr",
  "mad",
  "mia",
  "nrt",
  "ord",
  "otp",
  "phx",
  "qro",
  "scl",
  "sjc",
  "sea",
  "sin",
  "syd",
  "waw",
  "yul",
  "yyz",
] as const;

export const KOYEB_REGIONS = [
  "koyeb_fra",
  "koyeb_was",
  "koyeb_sin",
  "koyeb_tyo",
  "koyeb_par",
  "koyeb_sfo",
] as const;

export const RAILWAY_REGIONS = [
  "railway_europe-west4-drams3a",
  "railway_us-east4-eqdc4a",
  "railway_asia-southeast1-eqsg3a",
  "railway_us-west2",
] as const;

export const FREE_FLY_REGIONS = [
  "iad",
  "ams",
  "gru",
  "syd",
  "sin",
  "jnb",
] as const satisfies (typeof FLY_REGIONS)[number][];

export const ALL_REGIONS = [
  ...FLY_REGIONS,
  ...KOYEB_REGIONS,
  ...RAILWAY_REGIONS,
] as const;

export type Region = (typeof ALL_REGIONS)[number];

export type Continent =
  | "Europe"
  | "North America"
  | "South America"
  | "Asia"
  | "Africa"
  | "Oceania";

export type RegionInfo = {
  code: Region;
  location: string;
  flag: string;
  continent: Continent;
  deprecated: boolean;
  provider: "fly" | "koyeb" | "railway" | "private";
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

export const regionDict: Record<Region, RegionInfo> = {
  ams: {
    code: "ams",
    location: "Amsterdam, Netherlands",
    flag: "🇳🇱",
    continent: "Europe",
    deprecated: false,
    provider: "fly",
  },
  arn: {
    code: "arn",
    location: "Stockholm, Sweden",
    flag: "🇸🇪",
    continent: "Europe",
    deprecated: false,
    provider: "fly",
  },

  atl: {
    code: "atl",
    location: "Atlanta, Georgia, USA",
    flag: "🇺🇸",
    continent: "North America",
    deprecated: true,
    provider: "fly",
  },
  bog: {
    code: "bog",
    location: "Bogotá, Colombia",
    flag: "🇨🇴",
    continent: "South America",
    deprecated: true,
    provider: "fly",
  },
  bom: {
    code: "bom",
    location: "Mumbai, India",
    flag: "🇮🇳",
    continent: "Asia",
    deprecated: false,
    provider: "fly",
  },
  bos: {
    code: "bos",
    location: "Boston, Massachusetts, USA",
    flag: "🇺🇸",
    continent: "North America",
    deprecated: true,
    provider: "fly",
  },
  cdg: {
    code: "cdg",
    location: "Paris, France",
    flag: "🇫🇷",
    continent: "Europe",
    deprecated: false,
    provider: "fly",
  },
  den: {
    code: "den",
    location: "Denver, Colorado, USA",
    flag: "🇺🇸",
    continent: "North America",
    deprecated: true,
    provider: "fly",
  },
  dfw: {
    code: "dfw",
    location: "Dallas, Texas, USA",
    flag: "🇺🇸",
    continent: "North America",
    deprecated: false,
    provider: "fly",
  },
  ewr: {
    code: "ewr",
    location: "Secaucus, New Jersey, USA",
    flag: "🇺🇸",
    continent: "North America",
    deprecated: false,
    provider: "fly",
  },
  eze: {
    code: "eze",
    location: "Ezeiza, Argentina",
    flag: "🇦🇷",
    continent: "South America",
    deprecated: true,
    provider: "fly",
  },
  fra: {
    code: "fra",
    location: "Frankfurt, Germany",
    flag: "🇩🇪",
    continent: "Europe",
    deprecated: false,
    provider: "fly",
  },
  gdl: {
    code: "gdl",
    location: "Guadalajara, Mexico",
    flag: "🇲🇽",
    continent: "North America",
    deprecated: true,
    provider: "fly",
  },
  gig: {
    code: "gig",
    location: "Rio de Janeiro, Brazil",
    flag: "🇧🇷",
    continent: "South America",
    deprecated: true,
    provider: "fly",
  },
  gru: {
    code: "gru",
    location: "Sao Paulo, Brazil",
    flag: "🇧🇷",
    continent: "South America",
    deprecated: false,
    provider: "fly",
  },
  hkg: {
    code: "hkg",
    location: "Hong Kong, Hong Kong",
    flag: "🇭🇰",
    continent: "Asia",
    deprecated: true,
    provider: "fly",
  },
  iad: {
    code: "iad",
    location: "Ashburn, Virginia, USA",
    flag: "🇺🇸",
    continent: "North America",
    deprecated: false,
    provider: "fly",
  },
  jnb: {
    code: "jnb",
    location: "Johannesburg, South Africa",
    flag: "🇿🇦",
    continent: "Africa",
    deprecated: false,
    provider: "fly",
  },
  lax: {
    code: "lax",
    location: "Los Angeles, California, USA",
    flag: "🇺🇸",
    continent: "North America",
    deprecated: false,
    provider: "fly",
  },
  lhr: {
    code: "lhr",
    location: "London, United Kingdom",
    flag: "🇬🇧",
    continent: "Europe",
    deprecated: false,
    provider: "fly",
  },
  mad: {
    code: "mad",
    location: "Madrid, Spain",
    flag: "🇪🇸",
    continent: "Europe",
    deprecated: true,
    provider: "fly",
  },
  mia: {
    code: "mia",
    location: "Miami, Florida, USA",
    flag: "🇺🇸",
    continent: "North America",
    deprecated: true,
    provider: "fly",
  },
  nrt: {
    code: "nrt",
    location: "Tokyo, Japan",
    flag: "🇯🇵",
    continent: "Asia",
    deprecated: false,
    provider: "fly",
  },
  ord: {
    code: "ord",
    location: "Chicago, Illinois, USA",
    flag: "🇺🇸",
    continent: "North America",
    deprecated: false,
    provider: "fly",
  },
  otp: {
    code: "otp",
    location: "Bucharest, Romania",
    flag: "🇷🇴",
    continent: "Europe",
    deprecated: true,
    provider: "fly",
  },
  phx: {
    code: "phx",
    location: "Phoenix, Arizona, USA",
    flag: "🇺🇸",
    continent: "North America",
    deprecated: true,
    provider: "fly",
  },
  qro: {
    code: "qro",
    location: "Querétaro, Mexico",
    flag: "🇲🇽",
    continent: "North America",
    deprecated: true,
    provider: "fly",
  },
  scl: {
    code: "scl",
    location: "Santiago, Chile",
    flag: "🇨🇱",
    continent: "South America",
    deprecated: true,
    provider: "fly",
  },
  sjc: {
    code: "sjc",
    location: "San Jose, California, USA",
    flag: "🇺🇸",
    continent: "North America",
    deprecated: false,
    provider: "fly",
  },
  sea: {
    code: "sea",
    location: "Seattle, Washington, USA",
    flag: "🇺🇸",
    continent: "North America",
    deprecated: true,
    provider: "fly",
  },
  sin: {
    code: "sin",
    location: "Singapore, Singapore",
    flag: "🇸🇬",
    continent: "Asia",
    deprecated: false,
    provider: "fly",
  },
  syd: {
    code: "syd",
    location: "Sydney, Australia",
    flag: "🇦🇺",
    continent: "Oceania",
    deprecated: false,
    provider: "fly",
  },
  waw: {
    code: "waw",
    location: "Warsaw, Poland",
    flag: "🇵🇱",
    continent: "Europe",
    deprecated: true,
    provider: "fly",
  },
  yul: {
    code: "yul",
    location: "Montreal, Canada",
    flag: "🇨🇦",
    continent: "North America",
    deprecated: true,
    provider: "fly",
  },
  yyz: {
    code: "yyz",
    location: "Toronto, Canada",
    flag: "🇨🇦",
    continent: "North America",
    deprecated: false,
    provider: "fly",
  },
  koyeb_fra: {
    code: "koyeb_fra",
    location: "Frankfurt, Germany",
    flag: "🇩🇪",
    continent: "Europe",
    deprecated: false,
    provider: "koyeb",
  },
  koyeb_par: {
    code: "koyeb_par",
    location: "Paris, France",
    flag: "🇫🇷",
    continent: "Europe",
    deprecated: false,
    provider: "koyeb",
  },
  koyeb_sfo: {
    code: "koyeb_sfo",
    location: "San Francisco, USA",
    flag: "🇺🇸",
    continent: "North America",
    deprecated: false,
    provider: "koyeb",
  },
  koyeb_sin: {
    code: "koyeb_sin",
    location: "Singapore, Singapore",
    flag: "🇸🇬",
    continent: "Asia",
    deprecated: false,
    provider: "koyeb",
  },
  koyeb_tyo: {
    code: "koyeb_tyo",
    location: "Tokyo, Japan",
    flag: "🇯🇵",
    continent: "Asia",
    deprecated: false,
    provider: "koyeb",
  },
  koyeb_was: {
    code: "koyeb_was",
    location: "Washington, USA",
    flag: "🇺🇸",
    continent: "North America",
    deprecated: false,
    provider: "koyeb",
  },
  "railway_us-west2": {
    code: "railway_us-west2",
    location: "California, USA",
    flag: "🇺🇸",
    continent: "North America",
    deprecated: false,
    provider: "railway",
  },
  "railway_us-east4-eqdc4a": {
    code: "railway_us-east4-eqdc4a",
    location: "Virginia, USA",
    flag: "🇺🇸",
    continent: "North America",
    deprecated: false,
    provider: "railway",
  },
  "railway_europe-west4-drams3a": {
    code: "railway_europe-west4-drams3a",
    location: "Amsterdam, Netherlands",
    flag: "🇳🇱",
    continent: "Europe",
    deprecated: false,
    provider: "railway",
  },
  "railway_asia-southeast1-eqsg3a": {
    code: "railway_asia-southeast1-eqsg3a",
    location: "Singapore, Singapore",
    flag: "🇸🇬",
    continent: "Asia",
    deprecated: false,
    provider: "railway",
  },
} as const;

export const AVAILABLE_REGIONS = ALL_REGIONS.filter(
  (r) => !regionDict[r].deprecated,
);

export function formatRegionCode(region: RegionInfo | Region | string) {
  const r = typeof region === "string" ? getRegionInfo(region) : region;
  const suffix = r.code.replace(/(koyeb_|railway_|fly_)/g, "");

  if (r.provider === "railway") {
    return suffix.replace(/(-eqdc4a|-eqsg3a|-drams3a)/g, "");
  }

  return suffix;
}

// NOTE: opts is used to override the location for private locations
export function getRegionInfo(region: string, opts?: { location?: string }) {
  if (region in regionDict) {
    return regionDict[region as Region];
  }

  return {
    code: region,
    location: opts?.location ?? "Private Location",
    flag: "🌐",
    continent: "Private",
    deprecated: false,
    provider: "private",
  } satisfies Omit<RegionInfo, "code" | "continent"> & {
    code: string;
    continent: "Private";
  };
}

export const groupByContinent = Object.entries(regionDict).reduce<
  Record<Continent, RegionInfo[]>
>(
  (acc, [_key, value]) => {
    if (value.deprecated) {
      return acc;
    }
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
