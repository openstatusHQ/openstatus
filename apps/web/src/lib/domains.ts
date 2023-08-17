export const getSubdomain = (name: string, apexName: string) => {
  if (name === apexName) return null;
  return name.slice(0, name.length - apexName.length - 1);
};

export const getApexDomain = (url: string) => {
  let domain;
  try {
    domain = new URL(url).hostname;
  } catch (e) {
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
