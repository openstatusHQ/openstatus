export const regions = [
  {
    code: "ams",
    location: "Amsterdam, Netherlands",
    flag: "🇳🇱",
    continent: "Europe",
  },
  {
    code: "arn",
    location: "Stockholm, Sweden",
    flag: "🇸🇪",
    continent: "Europe",
  },
  {
    code: "atl",
    location: "Atlanta, Georgia, USA",
    flag: "🇺🇸",
    continent: "North America",
  },
  {
    code: "bog",
    location: "Bogotá, Colombia",
    flag: "🇨🇴",
    continent: "South America",
  },
  {
    code: "bom",
    location: "Mumbai, India",
    flag: "🇮🇳",
    continent: "Asia",
  },
  {
    code: "bos",
    location: "Boston, Massachusetts, USA",
    flag: "🇺🇸",
    continent: "North America",
  },
  {
    code: "cdg",
    location: "Paris, France",
    flag: "🇫🇷",
    continent: "Europe",
  },
  {
    code: "den",
    location: "Denver, Colorado, USA",
    flag: "🇺🇸",
    continent: "North America",
  },
  {
    code: "dfw",
    location: "Dallas, Texas, USA",
    flag: "🇺🇸",
    continent: "North America",
  },
  {
    code: "ewr",
    location: "Secaucus, New Jersey, USA",
    flag: "🇺🇸",
    continent: "North America",
  },
  {
    code: "eze",
    location: "Ezeiza, Argentina",
    flag: "🇦🇷",
    continent: "South America",
  },
  {
    code: "fra",
    location: "Frankfurt, Germany",
    flag: "🇩🇪",
    continent: "Europe",
  },
  {
    code: "gdl",
    location: "Guadalajara, Mexico",
    flag: "🇲🇽",
    continent: "North America",
  },
  {
    code: "gig",
    location: "Rio de Janeiro, Brazil",
    flag: "🇧🇷",
    continent: "South America",
  },
  {
    code: "gru",
    location: "Sao Paulo, Brazil",
    flag: "🇧🇷",
    continent: "South America",
  },
  {
    code: "hkg",
    location: "Hong Kong, Hong Kong",
    flag: "🇭🇰",
    continent: "Asia",
  },
  {
    code: "iad",
    location: "Ashburn, Virginia, USA",
    flag: "🇺🇸",
    continent: "North America",
  },
  {
    code: "jnb",
    location: "Johannesburg, South Africa",
    flag: "🇿🇦",
    continent: "Africa",
  },
  {
    code: "lax",
    location: "Los Angeles, California, USA",
    flag: "🇺🇸",
    continent: "North America",
  },
  {
    code: "lhr",
    location: "London, United Kingdom",
    flag: "🇬🇧",
    continent: "Europe",
  },
  {
    code: "mad",
    location: "Madrid, Spain",
    flag: "🇪🇸",
    continent: "Europe",
  },
  {
    code: "mia",
    location: "Miami, Florida, USA",
    flag: "🇺🇸",
    continent: "North America",
  },
  {
    code: "nrt",
    location: "Tokyo, Japan",
    flag: "🇯🇵",
    continent: "Asia",
  },
  {
    code: "ord",
    location: "Chicago, Illinois, USA",
    flag: "🇺🇸",
    continent: "North America",
  },
  {
    code: "otp",
    location: "Bucharest, Romania",
    flag: "🇷🇴",
    continent: "Europe",
  },
  {
    code: "phx",
    location: "Phoenix, Arizona, USA",
    flag: "🇺🇸",
    continent: "North America",
  },
  {
    code: "qro",
    location: "Querétaro, Mexico",
    flag: "🇲🇽",
    continent: "North America",
  },
  {
    code: "scl",
    location: "Santiago, Chile",
    flag: "🇨🇱",
    continent: "South America",
  },
  {
    code: "sjc",
    location: "San Jose, California, USA",
    flag: "🇺🇸",
    continent: "North America",
  },
  {
    code: "sea",
    location: "Seattle, Washington, USA",
    flag: "🇺🇸",
    continent: "North America",
  },
  {
    code: "sin",
    location: "Singapore, Singapore",
    flag: "🇸🇬",
    continent: "Asia",
  },
  {
    code: "syd",
    location: "Sydney, Australia",
    flag: "🇦🇺",
    continent: "Oceania",
  },
  {
    code: "waw",
    location: "Warsaw, Poland",
    flag: "🇵🇱",
    continent: "Europe",
  },
  {
    code: "yul",
    location: "Montreal, Canada",
    flag: "🇨🇦",
    continent: "North America",
  },
  {
    code: "yyz",
    location: "Toronto, Canada",
    flag: "🇨🇦",
    continent: "North America",
  },
] as const;

export type Region = (typeof regions)[number]["code"];

export const groupedRegions = regions.reduce(
  (acc, region) => {
    const continent = region.continent;
    if (!acc[continent]) {
      acc[continent] = [];
    }
    acc[continent].push(region.code);
    return acc;
  },
  {} as Record<string, Region[]>,
);

export const regionColors = {
  ams: "hsl(217.2 91.2% 59.8%)",
  arn: "hsl(238.7 83.5% 66.7%)",
  atl: "hsl(258.3 89.5% 66.3%)",
  bog: "hsl(270.7 91% 65.1%)",
  bom: "hsl(292.2 84.1% 60.6%)",
  bos: "hsl(330.4 81.2% 60.4%)",
  cdg: "hsl(349.7 89.2% 60.2%)",
  den: "hsl(215.4 16.3% 46.9%)",
  dfw: "hsl(220 8.9% 46.1%)",
  ewr: "hsl(240 3.8% 46.1%)",
  eze: "hsl(0 0% 45.1%)",
  fra: "hsl(25 5.3% 44.7%)",
  gdl: "hsl(0 84.2% 60.2%)",
  gig: "hsl(24.6 95% 53.1%)",
  gru: "hsl(37.7 92.1% 50.2%)",
  hkg: "hsl(45.4 93.4% 47.5%)",
  iad: "hsl(83.7 80.5% 44.3%)",
  jnb: "hsl(142.1 70.6% 45.3%)",
  lax: "hsl(160.1 84.1% 39.4%)",
  lhr: "hsl(173.4 80.4% 40%)",
  mad: "hsl(188.7 94.5% 42.7%)",
  mia: "hsl(198.6 88.7% 48.4%)",
  nrt: "hsl(217.2 91.2% 59.8%)",
  ord: "hsl(238.7 83.5% 66.7%)",
  otp: "hsl(258.3 89.5% 66.3%)",
  phx: "hsl(270.7 91% 65.1%)",
  qro: "hsl(292.2 84.1% 60.6%)",
  scl: "hsl(330.4 81.2% 60.4%)",
  sjc: "hsl(349.7 89.2% 60.2%)",
  sea: "hsl(215.4 16.3% 46.9%)",
  sin: "hsl(220 8.9% 46.1%)",
  syd: "hsl(240 3.8% 46.1%)",
  waw: "hsl(0 0% 45.1%)",
  yul: "hsl(25 5.3% 44.7%)",
  yyz: "hsl(0 84.2% 60.2%)",
} satisfies Record<Region, string>;
