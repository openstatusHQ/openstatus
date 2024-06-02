import type { Region } from "../types";

// https://vercel.com/docs/edge-network/regions
export const regions: Record<string, Region> = {
  arn1: { code: "arn1", location: "Stockholm, Sweden", flag: "🇸🇪" },
  bom1: { code: "bom1", location: "Mumbai, India", flag: "🇮🇳" },
  cdg1: { code: "cdg1", location: "Paris, France", flag: "🇫🇷" },
  cle1: { code: "cle1", location: "Cleveland, USA", flag: "🇺🇸" },
  cpt1: { code: "cpt1", location: "Cape Town, South Africa", flag: "🇿🇦" },
  dub1: { code: "dub1", location: "Dublin, Ireland", flag: "🇮🇪" },
  fra1: { code: "fra1", location: "Frankfurt, Germany", flag: "🇩🇪" },
  gru1: { code: "gru1", location: "São Paulo, Brazil", flag: "🇧🇷" },
  hkg1: { code: "hkg1", location: "Hong Kong", flag: "🇭🇰" },
  hnd1: { code: "hnd1", location: "Tokyo, Japan", flag: "🇯🇵" },
  iad1: { code: "iad1", location: "Washington, D.C., USA", flag: "🇺🇸" },
  icn1: { code: "icn1", location: "Seoul, South Korea", flag: "🇰🇷" },
  kix1: { code: "kix1", location: "Osaka, Japan", flag: "🇯🇵" },
  lhr1: { code: "lhr1", location: "London, United Kingdom", flag: "🇬🇧" },
  pdx1: { code: "pdx1", location: "Portland, USA", flag: "🇺🇸" },
  sfo1: { code: "sfo1", location: "San Francisco, USA", flag: "🇺🇸" },
  sin1: { code: "sin1", location: "Singapore", flag: "🇸🇬" },
  syd1: { code: "syd1", location: "Sydney, Australia", flag: "🇦🇺" },
};
