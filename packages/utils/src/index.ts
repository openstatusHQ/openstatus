export { assertSafeUrl, assertSafeUrlSync, safeUrlSchema } from "./ssrf";
export {
  httpPayloadSchema,
  type HttpPayload,
  tpcPayloadSchema,
  type TcpPayload,
  DNSPayloadSchema,
  type DNSPayload,
} from "./payloads";

export function transformHeaders(headers: { key: string; value: string }[]) {
  return headers.length > 0
    ? headers.reduce(
        (acc, curr) => {
          acc[curr.key] = curr.value;
          return acc;
        },
        {} as Record<string, string>,
      )
    : {};
}
