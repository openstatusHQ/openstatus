/**
 * AWS data center informations from 18 regions, supported by vercel.
 * https://vercel.com/docs/concepts/edge-network/regions#region-list
 */
export const regionsDict = {
  /**
   * A random location will be chosen
   */
  auto: {
    code: "auto",
    name: "random",
    location: "Random",
  },
  arn1: {
    code: "arn1",
    name: "eu-north-1",
    location: "Stockholm, Sweden",
  },
  bom1: {
    code: "bom1",
    name: "ap-south-1",
    location: "Mumbai, India",
  },
  cdg1: {
    code: "cdg1",
    name: "eu-west-3",
    location: "Paris, France",
  },
  cle1: {
    code: "cle1",
    name: "us-east-2",
    location: "Cleveland, USA",
  },
  cpt1: {
    code: "cpt1",
    name: "af-south-1",
    location: "Cape Town, South Africa",
  },
  dub1: {
    code: "dub1",
    name: "eu-west-1",
    location: "Dublin, Ireland",
  },
  fra1: {
    code: "fra1",
    name: "eu-central-1",
    location: "Frankfurt, Germany",
  },
  gru1: {
    code: "gru1",
    name: "sa-east-1",
    location: "São Paulo, Brazil",
  },
  hkg1: {
    code: "hkg1",
    name: "ap-east-1",
    location: "Hong Kong",
  },
  hnd1: {
    code: "hnd1",
    name: "ap-northeast-1",
    location: "Tokyo, Japan",
  },
  iad1: {
    code: "iad1",
    name: "us-east-1",
    location: "Washington, D.C., USA",
  },
  icn1: {
    code: "icn1",
    name: "ap-northeast-2",
    location: "Seoul, South Korea",
  },
  kix1: {
    code: "kix1",
    name: "ap-northeast-3",
    location: "Osaka, Japan",
  },
  lhr1: {
    code: "lhr1",
    name: "eu-west-2",
    location: "London, United Kingdom",
  },
  pdx1: {
    code: "pdx1",
    name: "us-west-2",
    location: "Portland, USA",
  },
  sfo1: {
    code: "sfo1",
    name: "us-west-1",
    location: "San Francisco, USA",
  },
  sin1: {
    code: "sin1",
    name: "ap-southeast-1",
    location: "Singapore",
  },
  syd1: {
    code: "syd1",
    name: "ap-southeast-2",
    location: "Sydney, Australia",
  },
} as const;
