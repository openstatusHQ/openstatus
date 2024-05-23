interface CfCacheStatusInfo {
  description: string;
  value: string;
}

export function parseCfCacheStatus(header: string): CfCacheStatusInfo {
  const description = getCacheDescription(header);
  return { description, value: header };
}

function getCacheDescription(key: string): string {
  switch (key.toUpperCase()) {
    case "HIT":
      return "Your resource was found in Cloudflare’s cache. This means that it has been previously accessed from your original server and loaded into Cache. It has not expired.";
    case "MISS":
      return "Cloudflare looked for your resource in cache but did not find it. Cloudflare went back to your origin server to retrieve the resource. The next time this resource is accessed its status should be HIT.";
    case "BYPASS":
      return "Cloudflare has been instructed to not cache this asset. It has been served directly from the origin. This is usually because something like an existing NO-CACHE header is being respected.";
    case "EXPIRED":
      return "Cloudflare has previously retrieved this resource, but its cache has expired. Cloudflare will go back to the origin to retrieve this resource again. The next time this resource is accessed its status should be HIT.";
    case "DYNAMIC":
      return "This resource is not cached by default and there are no explicit settings configured to cache it. You will see this frequently when Cloudflare is handling a POST request. This request will always go to the origin.";
    default:
      return "-";
  }
}
