export const getSubdomain = (name: string, apexName: string) => {
  if (name === apexName) return null;
  return name.slice(0, name.length - apexName.length - 1);
};

export const getApexDomain = (url: string) => {
  let domain: string;
  try {
    domain = new URL(url).hostname;
  } catch (e) {
    console.error(e);
    return "";
  }
  const parts = domain.split(".");
  if (parts.length > 2) {
    // if it's a subdomain (e.g. dub.vercel.app), return the last 2 parts
    return parts.slice(-2).join(".");
  }
  // if it's a normal domain (e.g. dub.sh), we return the domain
  return domain;
};

export function extractDomain(url: string) {
  // Use URL constructor to parse
  try {
    if (url.trim() === "") return "";

    const hostname = new URL(url).hostname; // e.g. "craft.mxkaske.dev"

    const parts = hostname.split("."); // ["craft", "mxkaske", "dev"]

    if (parts.length === 2) {
      // no subdomain
      return parts[0]; // "mxkaske"
    }
    if (parts.length > 2) {
      // has subdomain(s)
      return `${parts.slice(0, -2).join("-")}-${parts[parts.length - 2]}`;
      // "craft-mxkaske"
    }
    return "";
  } catch (e) {
    console.error(e);
    return "";
  }
}
