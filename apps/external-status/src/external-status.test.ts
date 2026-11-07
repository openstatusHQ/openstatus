import { upsertExternalIncidentsForService } from "@openstatus/services/external-service-incident";
import type { StatusFetcher } from "@openstatus/status-fetcher";
import { Effect, Semaphore } from "effect";
import { beforeEach, describe, expect, test, vi } from "vitest";

import {
  type Triplet,
  runIncidentPhase,
  runStatusPhase,
} from "./external-status";
import { TICK_CONCURRENCY } from "./external-status-detect";

vi.mock("@openstatus/services/external-service-incident", async (original) => ({
  ...(await original<object>()),
  upsertExternalIncidentsForService: vi.fn(),
}));

const upsertIncidents = vi.mocked(upsertExternalIncidentsForService);

function makeTriplets(count: number, fetcher: StatusFetcher): Triplet[] {
  return Array.from({ length: count }, (_, i) => ({
    row: { id: i },
    entry: {
      id: `service-${i}`,
      status_page_url: "https://status.example.com",
    },
    fetcher,
  })) as unknown as Triplet[];
}

const incident = {
  providerIncidentId: "inc-1",
  name: "Outage",
  status: "investigating",
  createdAt: new Date(0),
  resolvedAt: null,
  raw: {},
};

describe("external-status phases", () => {
  beforeEach(() => {
    upsertIncidents.mockReset();
  });

  test("phases running together share one limit on upstream requests", async () => {
    upsertIncidents.mockResolvedValue({ upserted: 0 });
    let running = 0;
    let peak = 0;
    const request = <A>(value: A) =>
      Effect.promise(async () => {
        running++;
        peak = Math.max(peak, running);
        await new Promise((resolve) => setTimeout(resolve, 5));
        running--;
        return value;
      });
    const fetcher = {
      name: "test",
      fetch: () => request({ severity: "none", status: "ok", description: "" }),
      fetchIncidents: () => request([]),
    } as unknown as StatusFetcher;
    const triplets = makeTriplets(TICK_CONCURRENCY * 2, fetcher);
    const permits = Semaphore.makeUnsafe(TICK_CONCURRENCY);

    await Effect.runPromise(
      Effect.all(
        [
          runStatusPhase(triplets, permits, 0),
          runIncidentPhase(triplets, permits, new Date(0)),
        ],
        { concurrency: "unbounded" },
      ),
    );

    expect(peak).toBe(TICK_CONCURRENCY);
  });

  test("a stalled upsert does not hold up other services' fetches", async () => {
    let settle = (_: { upserted: number }) => {};
    upsertIncidents.mockReturnValue(
      new Promise((resolve) => {
        settle = resolve;
      }),
    );
    const fetcher = {
      name: "test",
      fetch: () =>
        Effect.succeed({ severity: "none", status: "ok", description: "" }),
      fetchIncidents: () => Effect.succeed([incident]),
    } as unknown as StatusFetcher;
    // One permit: if a waiting upsert kept it, the status phase could never run.
    const permits = Semaphore.makeUnsafe(1);
    const triplets = makeTriplets(1, fetcher);

    const incidents = Effect.runPromise(
      runIncidentPhase(triplets, permits, new Date(0)),
    );
    await vi.waitFor(() => expect(upsertIncidents).toHaveBeenCalled());

    const statuses = await Effect.runPromise(
      runStatusPhase(triplets, permits, 0),
    );
    expect(statuses[0]?.kind).toBe("ok");

    settle({ upserted: 1 });
    expect((await incidents)[0]?.kind).toBe("ok");
  });
});
