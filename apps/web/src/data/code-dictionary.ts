export const codesDict = {
  "1xx": {
    prefix: 1,
    label: "1xx",
    name: "Informational",
  },
  "2xx": {
    prefix: 2,
    label: "2xx",
    name: "Successfull",
  },
  "3xx": {
    prefix: 3,
    label: "3xx",
    name: "Redirection",
  },
  "4xx": {
    prefix: 4,
    label: "4xx",
    name: "Client Error",
  },
  "5xx": {
    prefix: 5,
    label: "5xx",
    name: "Server Error",
  },
} as const;
