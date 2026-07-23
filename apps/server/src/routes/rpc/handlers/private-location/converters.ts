import {
  type PrivateLocation,
  PrivateLocationStatus,
  type PrivateLocationSummary,
} from "@openstatus/proto/private_location/v1";

type DBPrivateLocation = {
  id: number;
  name: string;
  token: string;
  status: "active" | "error";
  metadata: Record<string, string> | null;
  lastSeenAt: Date | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};

function toProtoStatus(status: "active" | "error"): PrivateLocationStatus {
  return status === "error"
    ? PrivateLocationStatus.ERROR
    : PrivateLocationStatus.ACTIVE;
}

export function dbPrivateLocationToProto(
  location: DBPrivateLocation,
  monitorIds: string[],
): PrivateLocation {
  return {
    $typeName: "openstatus.private_location.v1.PrivateLocation" as const,
    id: String(location.id),
    name: location.name,
    token: location.token,
    monitorIds,
    lastSeenAt: location.lastSeenAt?.toISOString() ?? "",
    createdAt: location.createdAt?.toISOString() ?? "",
    updatedAt: location.updatedAt?.toISOString() ?? "",
    metadata: location.metadata ?? {},
    status: toProtoStatus(location.status),
  };
}

/** The agent token is deliberately absent — list responses must not leak it. */
export function dbPrivateLocationToProtoSummary(
  location: DBPrivateLocation,
  monitorCount: number,
): PrivateLocationSummary {
  return {
    $typeName: "openstatus.private_location.v1.PrivateLocationSummary" as const,
    id: String(location.id),
    name: location.name,
    monitorCount,
    lastSeenAt: location.lastSeenAt?.toISOString() ?? "",
    createdAt: location.createdAt?.toISOString() ?? "",
    updatedAt: location.updatedAt?.toISOString() ?? "",
    status: toProtoStatus(location.status),
    metadata: location.metadata ?? {},
  };
}
