interface CacheControlInfo {
  directive: string; // unparsed directive
  description: string;
  name: string;
  value?: number;
}

export function parseCacheControlHeader(header: string): CacheControlInfo[] {
  const cacheControlDirectives = header
    .split(",")
    .map((directive) => directive.trim());

  const cacheControlInfo: CacheControlInfo[] = [];

  // biome-ignore lint/complexity/noForEach: <explanation>
  cacheControlDirectives.forEach((directive) => {
    const parts = directive.split("=");

    const name = parts[0].trim();
    const value = !Number.isNaN(Number(parts[1]))
      ? Number(parts[1])
      : undefined;
    const description = getDirectiveDescription(name);

    cacheControlInfo.push({ description, name, value, directive });
  });

  return cacheControlInfo;
}

function getDirectiveDescription(key: string): string {
  switch (key.toLowerCase()) {
    case "max-age":
      return "Specifies the maximum amount of time in seconds that a resource is considered fresh in a cache. After this time, the cache is required to revalidate the resource with the origin server.";
    case "max-stale":
      return "Indicates that a cache can serve a stale response even after its freshness lifetime has expired. Optionally, a value can be specified to indicate the maximum staleness allowed.";
    case "min-fresh":
      return "Specifies the minimum amount of time in seconds that a resource must be considered fresh. Caches should not serve a response that is older than this value without revalidating with the origin server.";
    case "s-maxage":
      return "Similar to max-age, but applies specifically to shared caches, such as proxy servers. Overrides max-age when present in shared caches.";
    case "no-cache":
      return "Forces caches to submit the request to the origin server for validation before releasing a cached copy. The response must be validated with the origin server before it can be used.";
    case "no-store":
      return "Instructs caches not to store any part of either the request or response. The content must be obtained from the origin server for each request.";
    case "no-transform":
      return "Specifies that intermediaries should not modify the content of the resource, such as by transcoding or compressing it.";
    case "only-if-cached":
      return "Indicates that a cache should respond only if the resource is available in the cache. It should not contact the origin server to retrieve the resource.";
    case "must-revalidate":
      return "Specifies that caches must revalidate stale responses with the origin server before using them.";
    case "proxy-revalidate":
      return "Similar to must-revalidate, but applies specifically to shared caches. It indicates that shared caches must revalidate stale responses with the origin server before using them.";
    case "private":
      return "Indicates that the response is intended for a single user and should not be cached by shared caches.";
    case "public":
      return "Specifies that the response may be cached by any cache, including both private and shared caches.";
    case "immutable":
      return "Indicates that the response body will not change over time. Caches can store immutable responses indefinitely.";
    case "stale-while-revalidate":
      return "Allows a cache to serve stale responses while asynchronously revalidating them with the origin server in the background.";
    case "stale-if-error":
      return "Allows a cache to serve stale responses if the origin server is unavailable or returns an error.";
    default:
      return "-";
  }
}
