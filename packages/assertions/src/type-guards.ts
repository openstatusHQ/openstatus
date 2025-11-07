import type {
  AssertionRequest,
  DnsAssertionRequest,
  HttpAssertionRequest,
} from "./types";

export function isHttpAssertionRequest(
  req: AssertionRequest,
): req is HttpAssertionRequest {
  return "status" in req && "header" in req && "body" in req;
}

export function isDnsAssertionRequest(
  req: AssertionRequest,
): req is DnsAssertionRequest {
  return "dnsRecords" in req;
}
