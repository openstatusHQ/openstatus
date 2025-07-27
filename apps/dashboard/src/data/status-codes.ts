export const statusCodes = [
  {
    code: 200 as const,
    bg: "bg-success",
    text: "text-success",
    name: "OK",
  },
  {
    code: 500 as const,
    bg: "bg-destructive",
    text: "text-destructive",
    name: "Internal Server Error",
  },
];

export type StatusCode = (typeof statusCodes)[number]["code"];

export const getStatusCodeVariant = (code?: number | null) => {
  if (!code) return "muted";
  if (code.toString().startsWith("2")) return "success";
  if (code.toString().startsWith("3")) return "info";
  if (code.toString().startsWith("4")) return "warning";
  if (code.toString().startsWith("5")) return "destructive";
  return "muted";
};

export const bgColors = {
  success: "bg-success",
  info: "bg-info",
  warning: "bg-warning",
  destructive: "bg-destructive",
  muted: "bg-muted",
};

export const textColors = {
  success: "text-success",
  info: "text-info",
  warning: "text-warning",
  destructive: "text-destructive",
  muted: "text-muted-foreground",
};
