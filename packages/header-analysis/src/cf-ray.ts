interface CfDataCenterInfo {
  code: string;
  location: string;
  flag: string;
}

export function parseCfRay(header: string): CfDataCenterInfo | string {
  const regex = /\b([A-Z]{3})\b/g;
  const arr = header.match(regex);
  if (!arr) return "Couldn't parse the header.";
  const dataCenter = cfDataCenters[arr[0]];
  if (dataCenter) return dataCenter;
  return `It seems like the data center '${arr[0]}' (iata) is not listed.`;
}

// List of all Cloudflare data center taken by https://www.feitsui.com/en/article/26
// We might miss some?!?
const cfDataCenters: Record<
  string,
  { code: string; location: string; flag: string }
> = {
  CGB: {
    code: "CGB",
    location: "Cuiabá, Brazil",
    flag: "🇧🇷",
  },
  COR: {
    code: "COR",
    location: "Córdoba, Argentina",
    flag: "🇦🇷",
  },
  BTS: {
    code: "BTS",
    location: "Bratislava, Slovakia",
    flag: "🇸🇰",
  },
  KHH: {
    code: "KHH",
    location: "Kaohsiung, Taiwan",
    flag: "🇹🇼",
  },
  GND: {
    code: "GND",
    location: "Grenada",
    flag: "🇬🇩",
  },
  NVT: {
    code: "NVT",
    location: "Navegantes, Brazil",
    flag: "🇧🇷",
  },
  ISU: {
    code: "ISU",
    location: "Sulaimaniyah, Iraq",
    flag: "🇮🇶",
  },
  PAP: {
    code: "PAP",
    location: "Port-au-Prince, Haiti",
    flag: "🇭🇹",
  },
  KLD: {
    code: "KLD",
    location: "Tver, Russia",
    flag: "🇷🇺",
  },
  REC: {
    code: "REC",
    location: "Recife, Brazil",
    flag: "🇧🇷",
  },
  FSD: {
    code: "FSD",
    location: "Sioux Falls, USA",
    flag: "🇺🇸",
  },
  ADB: {
    code: "ADB",
    location: "Izmir, Turkey",
    flag: "🇹🇷",
  },
  CHC: {
    code: "CHC",
    location: "Christchurch, New Zealand",
    flag: "🇳🇿",
  },
  UDI: {
    code: "UDI",
    location: "Uberlândia, Brazil",
    flag: "🇧🇷",
  },
  PPT: {
    code: "PPT",
    location: "Papeete, French Polynesia",
    flag: "🇵🇫",
  },
  KIN: {
    code: "KIN",
    location: "Kingston, Jamaica",
    flag: "🇯🇲",
  },
  STR: {
    code: "STR",
    location: "Stuttgart, Germany",
    flag: "🇩🇪",
  },
  COK: {
    code: "COK",
    location: "Kochi, India",
    flag: "🇮🇳",
  },
  KJA: {
    code: "KJA",
    location: "Krasnoyarsk, Russia",
    flag: "🇷🇺",
  },
  AUS: {
    code: "AUS",
    location: "Austin, USA",
    flag: "🇺🇸",
  },
  ORN: {
    code: "ORN",
    location: "Oran, Algeria",
    flag: "🇩🇿",
  },
  ACC: {
    code: "ACC",
    location: "Accra, Ghana",
    flag: "🇬🇭",
  },
  GDL: {
    code: "GDL",
    location: "Guadalajara, Mexico",
    flag: "🇲🇽",
  },
  SJK: {
    code: "SJK",
    location: "São José dos Campos, Brazil",
    flag: "🇧🇷",
  },
  AAE: {
    code: "AAE",
    location: "Annaba, Algeria",
    flag: "🇩🇿",
  },
  MDL: {
    code: "MDL",
    location: "Mandalay, Myanmar",
    flag: "🇲🇲",
  },
  DPS: {
    code: "DPS",
    location: "Denpasar, Indonesia",
    flag: "🇮🇩",
  },
  VIX: {
    code: "VIX",
    location: "Vitória, Brazil",
    flag: "🇧🇷",
  },
  FUK: {
    code: "FUK",
    location: "Fukuoka, Japan",
    flag: "🇯🇵",
  },
  CNN: {
    code: "CNN",
    location: "Chengdu, China",
    flag: "🇨🇳",
  },
  LYS: {
    code: "LYS",
    location: "Lyon, France",
    flag: "🇫🇷",
  },
  XAP: {
    code: "XAP",
    location: "Chapecó, Brazil",
    flag: "🇧🇷",
  },
  CAI: {
    code: "CAI",
    location: "Cairo, Egypt",
    flag: "🇪🇬",
  },
  RDU: {
    code: "RDU",
    location: "Raleigh-Durham, USA",
    flag: "🇺🇸",
  },
  CAW: {
    code: "CAW",
    location: "Campos dos Goytacazes, Brazil",
    flag: "🇧🇷",
  },
  OKC: {
    code: "OKC",
    location: "Oklahoma City, USA",
    flag: "🇺🇸",
  },
  SDQ: {
    code: "SDQ",
    location: "Santo Domingo, Dominican Republic",
    flag: "🇩🇴",
  },
  OUA: {
    code: "OUA",
    location: "Ouagadougou, Burkina Faso",
    flag: "🇧🇫",
  },
  YHZ: {
    code: "YHZ",
    location: "Halifax, Canada",
    flag: "🇨🇦",
  },
  ANC: {
    code: "ANC",
    location: "Anchorage, USA",
    flag: "🇺🇸",
  },
  LPB: {
    code: "LPB",
    location: "La Paz, Bolivia",
    flag: "🇧🇴",
  },
  SUV: {
    code: "SUV",
    location: "Suva, Fiji",
    flag: "🇫🇯",
  },
  BGR: {
    code: "BGR",
    location: "Bangor, USA",
    flag: "🇺🇸",
  },
  SJU: {
    code: "SJU",
    location: "San Juan, Puerto Rico",
    flag: "🇵🇷",
  },
  BBI: {
    code: "BBI",
    location: "Bhubaneswar, India",
    flag: "🇮🇳",
  },
  ALG: {
    code: "ALG",
    location: "Algiers, Algeria",
    flag: "🇩🇿",
  },
  LAD: {
    code: "LAD",
    location: "Luanda, Angola",
    flag: "🇦🇴",
  },
  EZE: {
    code: "EZE",
    location: "Buenos Aires, Argentina",
    flag: "🇦🇷",
  },
  NQN: {
    code: "NQN",
    location: "Neuquén, Argentina",
    flag: "🇦🇷",
  },
  EVN: {
    code: "EVN",
    location: "Yerevan, Armenia",
    flag: "🇦🇲",
  },
  ADL: {
    code: "ADL",
    location: "Adelaide, Australia",
    flag: "🇦🇺",
  },
  BNE: {
    code: "BNE",
    location: "Brisbane, Australia",
    flag: "🇦🇺",
  },
  CBR: {
    code: "CBR",
    location: "Canberra, Australia",
    flag: "🇦🇺",
  },
  HBA: {
    code: "HBA",
    location: "Hobart, Australia",
    flag: "🇦🇺",
  },
  MEL: {
    code: "MEL",
    location: "Melbourne, Australia",
    flag: "🇦🇺",
  },
  PER: {
    code: "PER",
    location: "Perth, Australia",
    flag: "🇦🇺",
  },
  SYD: {
    code: "SYD",
    location: "Sydney, Australia",
    flag: "🇦🇺",
  },
  VIE: {
    code: "VIE",
    location: "Vienna, Austria",
    flag: "🇦🇹",
  },
  LLK: {
    code: "LLK",
    location: "Luleå, Sweden",
    flag: "🇸🇪",
  },
  GYD: {
    code: "GYD",
    location: "Baku, Azerbaijan",
    flag: "🇦🇿",
  },
  BAH: {
    code: "BAH",
    location: "Manama, Bahrain",
    flag: "🇧🇭",
  },
  CGP: {
    code: "CGP",
    location: "Chittagong, Bangladesh",
    flag: "🇧🇩",
  },
  DAC: {
    code: "DAC",
    location: "Dhaka, Bangladesh",
    flag: "🇧🇩",
  },
  JSR: {
    code: "JSR",
    location: "Jessore, Bangladesh",
    flag: "🇧🇩",
  },
  MSQ: {
    code: "MSQ",
    location: "Minsk, Belarus",
    flag: "🇧🇾",
  },
  BRU: {
    code: "BRU",
    location: "Brussels, Belgium",
    flag: "🇧🇪",
  },
  PBH: {
    code: "PBH",
    location: "Paro, Bhutan",
    flag: "🇧🇹",
  },
  GBE: {
    code: "GBE",
    location: "Gaborone, Botswana",
    flag: "🇧🇼",
  },
  QWJ: {
    code: "QWJ",
    location: "Bouake, Ivory Coast",
    flag: "🇨🇮",
  },
  CNF: {
    code: "CNF",
    location: "Belo Horizonte, Brazil",
    flag: "🇧🇷",
  },
  BEL: {
    code: "BEL",
    location: "Belém, Brazil",
    flag: "🇧🇷",
  },
  BNU: {
    code: "BNU",
    location: "Blumenau, Brazil",
    flag: "🇧🇷",
  },
  BSB: {
    code: "BSB",
    location: "Brasília, Brazil",
    flag: "🇧🇷",
  },
  VCP: {
    code: "VCP",
    location: "Campinas, Brazil",
    flag: "🇧🇷",
  },
  CFC: {
    code: "CFC",
    location: "Cafelândia, Brazil",
    flag: "🇧🇷",
  },
  CWB: {
    code: "CWB",
    location: "Curitiba, Brazil",
    flag: "🇧🇷",
  },
  FLN: {
    code: "FLN",
    location: "Florianópolis, Brazil",
    flag: "🇧🇷",
  },
  FOR: {
    code: "FOR",
    location: "Fortaleza, Brazil",
    flag: "🇧🇷",
  },
  GYN: {
    code: "GYN",
    location: "Goiânia, Brazil",
    flag: "🇧🇷",
  },
  ITJ: {
    code: "ITJ",
    location: "Itajaí, Brazil",
    flag: "🇧🇷",
  },
  JOI: {
    code: "JOI",
    location: "Joinville, Brazil",
    flag: "🇧🇷",
  },
  JDO: {
    code: "JDO",
    location: "Juazeiro do Norte, Brazil",
    flag: "🇧🇷",
  },
  MAO: {
    code: "MAO",
    location: "Manaus, Brazil",
    flag: "🇧🇷",
  },
  POA: {
    code: "POA",
    location: "Porto Alegre, Brazil",
    flag: "🇧🇷",
  },
  RAO: {
    code: "RAO",
    location: "Ribeirão Preto, Brazil",
    flag: "🇧🇷",
  },
  GIG: {
    code: "GIG",
    location: "Rio de Janeiro, Brazil",
    flag: "🇧🇷",
  },
  SSA: {
    code: "SSA",
    location: "Salvador, Brazil",
    flag: "🇧🇷",
  },
  SOD: {
    code: "SOD",
    location: "Sorocaba, Brazil",
    flag: "🇧🇷",
  },
  SJP: {
    code: "SJP",
    location: "São José do Rio Preto, Brazil",
    flag: "🇧🇷",
  },
  GRU: {
    code: "GRU",
    location: "São Paulo, Brazil",
    flag: "🇧🇷",
  },
  BWN: {
    code: "BWN",
    location: "Bandar Seri Begawan, Brunei",
    flag: "🇧🇳",
  },
  SOF: {
    code: "SOF",
    location: "Sofia, Bulgaria",
    flag: "🇧🇬",
  },
  PNH: {
    code: "PNH",
    location: "Phnom Penh, Cambodia",
    flag: "🇰🇭",
  },
  YYC: {
    code: "YYC",
    location: "Calgary, Canada",
    flag: "🇨🇦",
  },
  YUL: {
    code: "YUL",
    location: "Montreal, Canada",
    flag: "🇨🇦",
  },
  YOW: {
    code: "YOW",
    location: "Ottawa, Canada",
    flag: "🇨🇦",
  },
  YXE: {
    code: "YXE",
    location: "Saskatoon, Canada",
    flag: "🇨🇦",
  },
  YYZ: {
    code: "YYZ",
    location: "Toronto, Canada",
    flag: "🇨🇦",
  },
  YVR: {
    code: "YVR",
    location: "Vancouver, Canada",
    flag: "🇨🇦",
  },
  YWG: {
    code: "YWG",
    location: "Winnipeg, Canada",
    flag: "🇨🇦",
  },
  ARI: {
    code: "ARI",
    location: "Arica, Chile",
    flag: "🇨🇱",
  },
  SCL: {
    code: "SCL",
    location: "Santiago, Chile",
    flag: "🇨🇱",
  },
  HKG: {
    code: "HKG",
    location: "Hong Kong, Hong Kong",
    flag: "🇭🇰",
  },
  MFM: {
    code: "MFM",
    location: "Macau, Macau",
    flag: "🇲🇴",
  },
  TPE: {
    code: "TPE",
    location: "Taipei, Taiwan",
    flag: "🇹🇼",
  },
  BOG: {
    code: "BOG",
    location: "Bogotá, Colombia",
    flag: "🇨🇴",
  },
  MDE: {
    code: "MDE",
    location: "Medellín, Colombia",
    flag: "🇨🇴",
  },
  SJO: {
    code: "SJO",
    location: "San José, Costa Rica",
    flag: "🇨🇷",
  },
  ZAG: {
    code: "ZAG",
    location: "Zagreb, Croatia",
    flag: "🇭🇷",
  },
  LCA: {
    code: "LCA",
    location: "Larnaca, Cyprus",
    flag: "🇨🇾",
  },
  PRG: {
    code: "PRG",
    location: "Prague, Czech Republic",
    flag: "🇨🇿",
  },
  CPH: {
    code: "CPH",
    location: "Copenhagen, Denmark",
    flag: "🇩🇰",
  },
  JIB: {
    code: "JIB",
    location: "Djibouti",
    flag: "🇩🇯",
  },
  GYE: {
    code: "GYE",
    location: "Guayaquil, Ecuador",
    flag: "🇪🇨",
  },
  UIO: {
    code: "UIO",
    location: "Quito, Ecuador",
    flag: "🇪🇨",
  },
  TLL: {
    code: "TLL",
    location: "Tallinn, Estonia",
    flag: "🇪🇪",
  },
  HEL: {
    code: "HEL",
    location: "Helsinki, Finland",
    flag: "🇫🇮",
  },
  MRS: {
    code: "MRS",
    location: "Marseille, France",
    flag: "🇫🇷",
  },
  CDG: {
    code: "CDG",
    location: "Paris, France",
    flag: "🇫🇷",
  },
  RUN: {
    code: "RUN",
    location: "Saint-Denis, Réunion",
    flag: "🇷🇪",
  },
  TBS: {
    code: "TBS",
    location: "Tbilisi, Georgia",
    flag: "🇬🇪",
  },
  TXL: {
    code: "TXL",
    location: "Berlin, Germany",
    flag: "🇩🇪",
  },
  DUS: {
    code: "DUS",
    location: "Düsseldorf, Germany",
    flag: "🇩🇪",
  },
  FRA: {
    code: "FRA",
    location: "Frankfurt, Germany",
    flag: "🇩🇪",
  },
  HAM: {
    code: "HAM",
    location: "Hamburg, Germany",
    flag: "🇩🇪",
  },
  MUC: {
    code: "MUC",
    location: "Munich, Germany",
    flag: "🇩🇪",
  },
  ATH: {
    code: "ATH",
    location: "Athens, Greece",
    flag: "🇬🇷",
  },
  SKG: {
    code: "SKG",
    location: "Thessaloniki, Greece",
    flag: "🇬🇷",
  },
  GUM: {
    code: "GUM",
    location: "Hagåtña, Guam",
    flag: "🇬🇺",
  },
  GUA: {
    code: "GUA",
    location: "Guatemala City, Guatemala",
    flag: "🇬🇹",
  },
  GEO: {
    code: "GEO",
    location: "Georgetown, Guyana",
    flag: "🇬🇾",
  },
  TGU: {
    code: "TGU",
    location: "Tegucigalpa, Honduras",
    flag: "🇭🇳",
  },
  BUD: {
    code: "BUD",
    location: "Budapest, Hungary",
    flag: "🇭🇺",
  },
  KEF: {
    code: "KEF",
    location: "Reykjavík, Iceland",
    flag: "🇮🇸",
  },
  AMD: {
    code: "AMD",
    location: "Ahmedabad, India",
    flag: "🇮🇳",
  },
  BLR: {
    code: "BLR",
    location: "Bengaluru, India",
    flag: "🇮🇳",
  },
  IXC: {
    code: "IXC",
    location: "Chandigarh, India",
    flag: "🇮🇳",
  },
  MAA: {
    code: "MAA",
    location: "Chennai, India",
    flag: "🇮🇳",
  },
  HYD: {
    code: "HYD",
    location: "Hyderabad, India",
    flag: "🇮🇳",
  },
  KNU: {
    code: "KNU",
    location: "Kanpur, India",
    flag: "🇮🇳",
  },
  CCU: {
    code: "CCU",
    location: "Kolkata, India",
    flag: "🇮🇳",
  },
  BOM: {
    code: "BOM",
    location: "Mumbai, India",
    flag: "🇮🇳",
  },
  NAG: {
    code: "NAG",
    location: "Nagpur, India",
    flag: "🇮🇳",
  },
  DEL: {
    code: "DEL",
    location: "New Delhi, India",
    flag: "🇮🇳",
  },
  PAT: {
    code: "PAT",
    location: "Patna, India",
    flag: "🇮🇳",
  },
  CGK: {
    code: "CGK",
    location: "Jakarta, Indonesia",
    flag: "🇮🇩",
  },
  JOG: {
    code: "JOG",
    location: "Yogyakarta, Indonesia",
    flag: "🇮🇩",
  },
  BGW: {
    code: "BGW",
    location: "Baghdad, Iraq",
    flag: "🇮🇶",
  },
  BSR: {
    code: "BSR",
    location: "Basra, Iraq",
    flag: "🇮🇶",
  },
  EBL: {
    code: "EBL",
    location: "Erbil, Iraq",
    flag: "🇮🇶",
  },
  NJF: {
    code: "NJF",
    location: "Najaf, Iraq",
    flag: "🇮🇶",
  },
  XNH: {
    code: "XNH",
    location: "Nouadhibou, Mauritania",
    flag: "🇲🇷",
  },
  ORK: {
    code: "ORK",
    location: "Cork, Ireland",
    flag: "🇮🇪",
  },
  DUB: {
    code: "DUB",
    location: "Dublin, Ireland",
    flag: "🇮🇪",
  },
  HFA: {
    code: "HFA",
    location: "Haifa, Israel",
    flag: "🇮🇱",
  },
  TLV: {
    code: "TLV",
    location: "Tel-Aviv, Israel",
    flag: "🇮🇱",
  },
  MXP: {
    code: "MXP",
    location: "Milan, Italy",
    flag: "🇮🇹",
  },
  PMO: {
    code: "PMO",
    location: "Palermo, Italy",
    flag: "🇮🇹",
  },
  FCO: {
    code: "FCO",
    location: "Rome, Italy",
    flag: "🇮🇹",
  },
  OKA: {
    code: "OKA",
    location: "Okinawa, Japan",
    flag: "🇯🇵",
  },
  KIX: {
    code: "KIX",
    location: "Osaka, Japan",
    flag: "🇯🇵",
  },
  NRT: {
    code: "NRT",
    location: "Tokyo, Japan",
    flag: "🇯🇵",
  },
  AMM: {
    code: "AMM",
    location: "Amman, Jordan",
    flag: "🇯🇴",
  },
  ALA: {
    code: "ALA",
    location: "Almaty, Kazakhstan",
    flag: "🇰🇿",
  },
  MBA: {
    code: "MBA",
    location: "Mombasa, Kenya",
    flag: "🇰🇪",
  },
  NBO: {
    code: "NBO",
    location: "Nairobi, Kenya",
    flag: "🇰🇪",
  },
  KWI: {
    code: "KWI",
    location: "Kuwait City, Kuwait",
    flag: "🇰🇼",
  },
  VTE: {
    code: "VTE",
    location: "Vientiane, Laos",
    flag: "🇱🇦",
  },
  RIX: {
    code: "RIX",
    location: "Riga, Latvia",
    flag: "🇱🇻",
  },
  VNO: {
    code: "VNO",
    location: "Vilnius, Lithuania",
    flag: "🇱🇹",
  },
  LUX: {
    code: "LUX",
    location: "Luxembourg",
    flag: "🇱🇺",
  },
  TNR: {
    code: "TNR",
    location: "Antananarivo, Madagascar",
    flag: "🇲🇬",
  },
  JHB: {
    code: "JHB",
    location: "Johor Bahru, Malaysia",
    flag: "🇲🇾",
  },
  KUL: {
    code: "KUL",
    location: "Kuala Lumpur, Malaysia",
    flag: "🇲🇾",
  },
  MLE: {
    code: "MLE",
    location: "Malé, Maldives",
    flag: "🇲🇻",
  },
  MRU: {
    code: "MRU",
    location: "Port Louis, Mauritius",
    flag: "🇲🇺",
  },
  MEX: {
    code: "MEX",
    location: "Mexico City, Mexico",
    flag: "🇲🇽",
  },
  QRO: {
    code: "QRO",
    location: "Querétaro, Mexico",
    flag: "🇲🇽",
  },
  KIV: {
    code: "KIV",
    location: "Chișinău, Moldova",
    flag: "🇲🇩",
  },
  ULN: {
    code: "ULN",
    location: "Ulaanbaatar, Mongolia",
    flag: "🇲🇳",
  },
  CMN: {
    code: "CMN",
    location: "Casablanca, Morocco",
    flag: "🇲🇦",
  },
  MPM: {
    code: "MPM",
    location: "Maputo, Mozambique",
    flag: "🇲🇿",
  },
  RGN: {
    code: "RGN",
    location: "Yangon, Myanmar",
    flag: "🇲🇲",
  },
  KTM: {
    code: "KTM",
    location: "Kathmandu, Nepal",
    flag: "🇳🇵",
  },
  AMS: {
    code: "AMS",
    location: "Amsterdam, Netherlands",
    flag: "🇳🇱",
  },
  NOU: {
    code: "NOU",
    location: "Nouméa, New Caledonia",
    flag: "🇳🇨",
  },
  AKL: {
    code: "AKL",
    location: "Auckland, New Zealand",
    flag: "🇳🇿",
  },
  LOS: {
    code: "LOS",
    location: "Lagos, Nigeria",
    flag: "🇳🇬",
  },
  OSL: {
    code: "OSL",
    location: "Oslo, Norway",
    flag: "🇳🇴",
  },
  MCT: {
    code: "MCT",
    location: "Muscat, Oman",
    flag: "🇴🇲",
  },
  ISB: {
    code: "ISB",
    location: "Islamabad, Pakistan",
    flag: "🇵🇰",
  },
  KHI: {
    code: "KHI",
    location: "Karachi, Pakistan",
    flag: "🇵🇰",
  },
  LHE: {
    code: "LHE",
    location: "Lahore, Pakistan",
    flag: "🇵🇰",
  },
  ZDM: {
    code: "ZDM",
    location: "Zahedan, Iran",
    flag: "🇮🇷",
  },
  PTY: {
    code: "PTY",
    location: "Panama City, Panama",
    flag: "🇵🇦",
  },
  ASU: {
    code: "ASU",
    location: "Asunción, Paraguay",
    flag: "🇵🇾",
  },
  LIM: {
    code: "LIM",
    location: "Lima, Peru",
    flag: "🇵🇪",
  },
  CGY: {
    code: "CGY",
    location: "Cagayan de Oro, Philippines",
    flag: "🇵🇭",
  },
  CEB: {
    code: "CEB",
    location: "Cebu, Philippines",
    flag: "🇵🇭",
  },
  MNL: {
    code: "MNL",
    location: "Manila, Philippines",
    flag: "🇵🇭",
  },
  WAW: {
    code: "WAW",
    location: "Warsaw, Poland",
    flag: "🇵🇱",
  },
  LIS: {
    code: "LIS",
    location: "Lisbon, Portugal",
    flag: "🇵🇹",
  },
  DOH: {
    code: "DOH",
    location: "Doha, Qatar",
    flag: "🇶🇦",
  },
  OTP: {
    code: "OTP",
    location: "Bucharest, Romania",
    flag: "🇷🇴",
  },
  LED: {
    code: "LED",
    location: "Saint Petersburg, Russia",
    flag: "🇷🇺",
  },
  DME: {
    code: "DME",
    location: "Moscow, Russia",
    flag: "🇷🇺",
  },
  KZN: {
    code: "KZN",
    location: "Kazan, Russia",
    flag: "🇷🇺",
  },
  KRR: {
    code: "KRR",
    location: "Krasnodar, Russia",
    flag: "🇷🇺",
  },
  SVX: {
    code: "SVX",
    location: "Yekaterinburg, Russia",
    flag: "🇷🇺",
  },
  KGL: {
    code: "KGL",
    location: "Kigali, Rwanda",
    flag: "🇷🇼",
  },
  JED: {
    code: "JED",
    location: "Jeddah, Saudi Arabia",
    flag: "🇸🇦",
  },
  RUH: {
    code: "RUH",
    location: "Riyadh, Saudi Arabia",
    flag: "🇸🇦",
  },
  DKR: {
    code: "DKR",
    location: "Dakar, Senegal",
    flag: "🇸🇳",
  },
  BEG: {
    code: "BEG",
    location: "Belgrade, Serbia",
    flag: "🇷🇸",
  },
  SGP: {
    code: "SGP",
    location: "Singapore",
    flag: "🇸🇬",
  },
  LJU: {
    code: "LJU",
    location: "Ljubljana, Slovenia",
    flag: "🇸🇮",
  },
  CPT: {
    code: "CPT",
    location: "Cape Town, South Africa",
    flag: "🇿🇦",
  },
  DUR: {
    code: "DUR",
    location: "Durban, South Africa",
    flag: "🇿🇦",
  },
  JNB: {
    code: "JNB",
    location: "Johannesburg, South Africa",
    flag: "🇿🇦",
  },
  ICN: {
    code: "ICN",
    location: "Seoul, South Korea",
    flag: "🇰🇷",
  },
  MAD: {
    code: "MAD",
    location: "Madrid, Spain",
    flag: "🇪🇸",
  },
  BCN: {
    code: "BCN",
    location: "Barcelona, Spain",
    flag: "🇪🇸",
  },
  GOT: {
    code: "GOT",
    location: "Gothenburg, Sweden",
    flag: "🇸🇪",
  },
  ARN: {
    code: "ARN",
    location: "Stockholm, Sweden",
    flag: "🇸🇪",
  },
  BSL: {
    code: "BSL",
    location: "Basel, Switzerland",
    flag: "🇨🇭",
  },
  GVA: {
    code: "GVA",
    location: "Geneva, Switzerland",
    flag: "🇨🇭",
  },
  ZRH: {
    code: "ZRH",
    location: "Zürich, Switzerland",
    flag: "🇨🇭",
  },
  DAR: {
    code: "DAR",
    location: "Dar es Salaam, Tanzania",
    flag: "🇹🇿",
  },
  BKK: {
    code: "BKK",
    location: "Bangkok, Thailand",
    flag: "🇹🇭",
  },
  IST: {
    code: "IST",
    location: "Istanbul, Turkey",
    flag: "🇹🇷",
  },
  TUN: {
    code: "TUN",
    location: "Tunis, Tunisia",
    flag: "🇹🇳",
  },
  KBP: {
    code: "KBP",
    location: "Kyiv, Ukraine",
    flag: "🇺🇦",
  },
  DXB: {
    code: "DXB",
    location: "Dubai, United Arab Emirates",
    flag: "🇦🇪",
  },
  EDI: {
    code: "EDI",
    location: "Edinburgh, United Kingdom",
    flag: "🇬🇧",
  },
  LHR: {
    code: "LHR",
    location: "London, United Kingdom",
    flag: "🇬🇧",
  },
  MAN: {
    code: "MAN",
    location: "Manchester, United Kingdom",
    flag: "🇬🇧",
  },
  IAD: {
    code: "IAD",
    location: "Washington, USA",
    flag: "🇺🇸",
  },
  ATL: {
    code: "ATL",
    location: "Atlanta, USA",
    flag: "🇺🇸",
  },
  BOS: {
    code: "BOS",
    location: "Boston, USA",
    flag: "🇺🇸",
  },
  BUF: {
    code: "BUF",
    location: "Buffalo, USA",
    flag: "🇺🇸",
  },
  CLT: {
    code: "CLT",
    location: "Charlotte, USA",
    flag: "🇺🇸",
  },
  ORD: {
    code: "ORD",
    location: "Chicago, USA",
    flag: "🇺🇸",
  },
  CMH: {
    code: "CMH",
    location: "Columbus, USA",
    flag: "🇺🇸",
  },
  DFW: {
    code: "DFW",
    location: "Dallas, USA",
    flag: "🇺🇸",
  },
  DEN: {
    code: "DEN",
    location: "Denver, USA",
    flag: "🇺🇸",
  },
  DTW: {
    code: "DTW",
    location: "Detroit, USA",
    flag: "🇺🇸",
  },
  HNL: {
    code: "HNL",
    location: "Honolulu, USA",
    flag: "🇺🇸",
  },
  IAH: {
    code: "IAH",
    location: "Houston, USA",
    flag: "🇺🇸",
  },
  JAX: {
    code: "JAX",
    location: "Jacksonville, USA",
    flag: "🇺🇸",
  },
  MCI: {
    code: "MCI",
    location: "Kansas City, USA",
    flag: "🇺🇸",
  },
  LAS: {
    code: "LAS",
    location: "Las Vegas, USA",
    flag: "🇺🇸",
  },
  LAX: {
    code: "LAX",
    location: "Los Angeles, USA",
    flag: "🇺🇸",
  },
  MFE: {
    code: "MFE",
    location: "McAllen, USA",
    flag: "🇺🇸",
  },
  MEM: {
    code: "MEM",
    location: "Memphis, USA",
    flag: "🇺🇸",
  },
  MIA: {
    code: "MIA",
    location: "Miami, USA",
    flag: "🇺🇸",
  },
  MSP: {
    code: "MSP",
    location: "Minneapolis, USA",
    flag: "🇺🇸",
  },
  MGM: {
    code: "MGM",
    location: "Montgomery, USA",
    flag: "🇺🇸",
  },
  BNA: {
    code: "BNA",
    location: "Nashville, USA",
    flag: "🇺🇸",
  },
  EWR: {
    code: "EWR",
    location: "Newark, USA",
    flag: "🇺🇸",
  },
  OMA: {
    code: "OMA",
    location: "Omaha, USA",
    flag: "🇺🇸",
  },
  PHL: {
    code: "PHL",
    location: "Philadelphia, USA",
    flag: "🇺🇸",
  },
  PHX: {
    code: "PHX",
    location: "Phoenix, USA",
    flag: "🇺🇸",
  },
  PIT: {
    code: "PIT",
    location: "Pittsburgh, USA",
    flag: "🇺🇸",
  },
  PDX: {
    code: "PDX",
    location: "Portland, USA",
    flag: "🇺🇸",
  },
  RIC: {
    code: "RIC",
    location: "Richmond, USA",
    flag: "🇺🇸",
  },
  SMF: {
    code: "SMF",
    location: "Sacramento, USA",
    flag: "🇺🇸",
  },
  SLC: {
    code: "SLC",
    location: "Salt Lake City, USA",
    flag: "🇺🇸",
  },
  SAN: {
    code: "SAN",
    location: "San Diego, USA",
    flag: "🇺🇸",
  },
  SFO: {
    code: "SFO",
    location: "San Francisco, USA",
    flag: "🇺🇸",
  },
  SJC: {
    code: "SJC",
    location: "San Jose, USA",
    flag: "🇺🇸",
  },
  SEA: {
    code: "SEA",
    location: "Seattle, USA",
    flag: "🇺🇸",
  },
  IND: {
    code: "IND",
    location: "Indianapolis, USA",
    flag: "🇺🇸",
  },
  STL: {
    code: "STL",
    location: "St. Louis, USA",
    flag: "🇺🇸",
  },
  TLH: {
    code: "TLH",
    location: "Tallahassee, USA",
    flag: "🇺🇸",
  },
  TPA: {
    code: "TPA",
    location: "Tampa, USA",
    flag: "🇺🇸",
  },
  TAS: {
    code: "TAS",
    location: "Tashkent, Uzbekistan",
    flag: "🇺🇿",
  },
  HAN: {
    code: "HAN",
    location: "Hanoi, Vietnam",
    flag: "🇻🇳",
  },
  SGN: {
    code: "SGN",
    location: "Ho Chi Minh City, Vietnam",
    flag: "🇻🇳",
  },
  HRE: {
    code: "HRE",
    location: "Harare, Zimbabwe",
    flag: "🇿🇼",
  },
};
