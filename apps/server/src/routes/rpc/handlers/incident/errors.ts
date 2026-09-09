import { Code, ConnectError } from "@connectrpc/connect";

export function incidentIdRequiredError(): ConnectError {
  return new ConnectError("Incident id is required", Code.InvalidArgument);
}

export function invalidIncidentIdError(id: string): ConnectError {
  return new ConnectError(`Invalid incident id: "${id}"`, Code.InvalidArgument);
}

export function unsupportedEnumError(field: string): ConnectError {
  return new ConnectError(
    `Unsupported value for ${field}`,
    Code.InvalidArgument,
  );
}
