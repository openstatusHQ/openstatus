import type {
  PrivateLocation,
  PrivateLocationSummary,
} from "@openstatus/proto/private_location/v1";

type DBPrivateLocation = {
  id: number;
  name: string;
  token: string;
  lastSeenAt: Date | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};

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
  };
}
