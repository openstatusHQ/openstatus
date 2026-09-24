export {
  assertSafeUrl,
  assertSafeUrlSync,
  safeFetch,
  safeUrlSchema,
} from "./ssrf";
export {
  type DNSPayload,
  DNSPayloadSchema,
  GRPC_TLS_MODES,
  type GrpcPayload,
  grpcPayloadSchema,
  type HttpPayload,
  httpPayloadSchema,
  type IcmpPayload,
  icmpPayloadSchema,
  type TcpPayload,
  tpcPayloadSchema,
} from "./payloads";
export {
  MONITOR_JOB_TYPES,
  MONITOR_METHODS,
  MONITOR_STATUSES,
} from "./constants";
export { buildCurlCommand, type CurlRequest } from "./curl";
export { type HeaderPair, headerPairSchema } from "./headers";
export { iteratorToStream, yieldMany } from "./stream";
export { type PageUpdateStatus, statusLabel } from "./status";

export function transformHeaders(
  headers: { key: string; value: string }[],
): Record<string, string> {
  return Object.fromEntries(headers.map(({ key, value }) => [key, value]));
}
