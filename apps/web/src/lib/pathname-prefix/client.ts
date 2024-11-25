export function getPathnamePrefix() {
  if (typeof window === "undefined") return "/app"; // DEFAULT

  const host = window.location.host;
  const prefix = host?.split(".")[0] === "app" ? "" : "/app";
  return prefix;
}
