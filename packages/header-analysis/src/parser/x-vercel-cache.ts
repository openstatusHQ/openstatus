interface VercelCacheInfo {
  description: string;
  value: string;
}

export function parseXVercelCache(header: string): VercelCacheInfo {
  const description = getCacheDescription(header);
  return { description, value: header };
}

function getCacheDescription(key: string): string {
  switch (key.toUpperCase()) {
    case "MISS":
      return "The response was not found in the edge cache and was fetched from the origin server.";
    case "HIT":
      return "The response was served from the edge cache.";
    case "STALE":
      return "The response was served from the edge cache. A background request to the origin server was made to update the content.";
    case "PRERENDER":
      return "The response was served from static storage.";
    case "REVLIDATED":
      return "The response was served from the origin server and the cache was refreshed due to an authorization from the user in the incoming request.";
    default:
      return "-";
  }
}
