import { describe, expect, it } from "vitest";

import type { IncidentSlaSnapshot } from "./constants";
import {
  type IncidentSlaFields,
  incidentAwaitsAcknowledgement,
  incidentResolutionPatch,
  incidentResponsePatch,
  incidentSlaHeadline,
  incidentSlaState,
} from "./state";

const declaredAt = new Date("2026-11-11T12:00:00.000Z");
const at = (minutes: number) =>
  new Date(declaredAt.getTime() + minutes * 60_000);

// critical: 60m response (warning at 45m); minor has no response target; major missing
const snapshot: IncidentSlaSnapshot = {
  targets: {
    critical: { responseMinutes: 60, resolutionMinutes: 240 },
    minor: { resolutionMinutes: 4320 },
  },
  resolutionStop: "mitigated",
};

const base: IncidentSlaFields = {
  status: "open",
  severity: "critical",
  declaredAt,
  slaSnapshot: snapshot,
  responseMetAt: null,
  responseBreachDueAt: null,
  resolutionStoppedAt: null,
  resolutionBreachDueAt: null,
};

const response = (incident: Partial<IncidentSlaFields>, now: Date) =>
  incidentSlaState({ ...base, ...incident }, now)?.response ?? null;

describe("incidentSlaState", () => {
  it("is null without a snapshot", () => {
    expect(incidentSlaState({ ...base, slaSnapshot: null }, at(1))).toBeNull();
  });

  it("is null for a canceled incident", () => {
    expect(incidentSlaState({ ...base, status: "canceled" }, at(1))).toBeNull();
  });

  it("carries the resolution stop of the snapshot", () => {
    expect(incidentSlaState(base, at(1))?.resolutionStop).toBe("mitigated");
  });

  it("runs before the warning point, with due and warning times", () => {
    expect(response({}, at(44))).toEqual({
      targetMinutes: 60,
      startsAt: declaredAt,
      dueAt: at(60),
      warnAt: at(45),
      metAt: null,
      breachDueAt: null,
      missReason: null,
      status: "running",
    });
  });

  it("is at risk from the warning point on", () => {
    expect(response({}, new Date(at(45).getTime() - 1))?.status).toBe(
      "running",
    );
    expect(response({}, at(45))?.status).toBe("at_risk");
  });

  it("is still at risk exactly at the due time and breached after it", () => {
    expect(response({}, at(60))?.status).toBe("at_risk");
    expect(response({}, new Date(at(60).getTime() + 1))?.status).toBe(
      "breached",
    );
  });

  it("is met once a response time is stored, however late now is", () => {
    expect(response({ responseMetAt: at(4) }, at(500))?.status).toBe("met");
  });

  it("is breached once a miss is stamped, even when met", () => {
    const timer = response(
      { responseMetAt: at(90), responseBreachDueAt: at(60) },
      at(91),
    );
    expect(timer?.status).toBe("breached");
    expect(timer?.dueAt).toEqual(at(60));
  });

  it("has no timer when the severity has no response target", () => {
    expect(response({ severity: "minor" }, at(1))).toBeNull();
  });

  it("has no timer when the severity is missing from the snapshot", () => {
    expect(response({ severity: "major" }, at(1))).toBeNull();
    expect(incidentSlaState({ ...base, severity: "major" }, at(1))).not.toBe(
      null,
    );
  });

  it("keeps a stamped miss after a downgrade to a severity without a target", () => {
    const timer = response(
      { severity: "minor", responseBreachDueAt: at(60) },
      at(100),
    );
    expect(timer?.status).toBe("breached");
    expect(timer?.targetMinutes).toBe(60);
  });

  it("moves the due time of a running timer with the severity", () => {
    const slaSnapshot = {
      ...snapshot,
      targets: {
        ...snapshot.targets,
        major: { responseMinutes: 240 },
      },
    };
    expect(response({ slaSnapshot }, at(70))?.status).toBe("breached");
    const downgraded = response({ slaSnapshot, severity: "major" }, at(70));
    expect(downgraded?.dueAt).toEqual(at(240));
    expect(downgraded?.status).toBe("running");
  });

  it("does not re-judge a met timer after an upgrade", () => {
    const slaSnapshot = {
      ...snapshot,
      targets: { ...snapshot.targets, critical: { responseMinutes: 5 } },
    };
    expect(
      response({ slaSnapshot, responseMetAt: at(30) }, at(40))?.status,
    ).toBe("met");
  });
});

describe("incidentResponsePatch", () => {
  it("meets an on-time response without a miss", () => {
    expect(incidentResponsePatch(base, at(60))).toEqual({
      responseMetAt: at(60),
    });
  });

  it("records the missed due time when met late", () => {
    expect(incidentResponsePatch(base, at(61))).toEqual({
      responseMetAt: at(61),
      responseBreachDueAt: at(60),
    });
  });

  it("sets nothing once met, untracked or canceled", () => {
    expect(
      incidentResponsePatch({ ...base, responseMetAt: at(1) }, at(2)),
    ).toEqual({});
    expect(
      incidentResponsePatch({ ...base, slaSnapshot: null }, at(2)),
    ).toEqual({});
    expect(
      incidentResponsePatch({ ...base, status: "canceled" }, at(2)),
    ).toEqual({});
  });

  it("stores the response time even without a response target", () => {
    expect(
      incidentResponsePatch({ ...base, severity: "minor" }, at(9)),
    ).toEqual({ responseMetAt: at(9) });
  });

  it("keeps an already stamped miss", () => {
    expect(
      incidentResponsePatch({ ...base, responseBreachDueAt: at(60) }, at(70)),
    ).toEqual({ responseMetAt: at(70) });
  });
});

describe("incidentAwaitsAcknowledgement", () => {
  const row = { ...base, acknowledgedAt: null, closedAt: null };

  it("is offered on a tracked, unacknowledged, open or mitigated incident", () => {
    expect(incidentAwaitsAcknowledgement(row)).toBe(true);
    expect(incidentAwaitsAcknowledgement({ ...row, status: "mitigated" })).toBe(
      true,
    );
  });

  it("is not offered when untracked, acknowledged, resolved or closed", () => {
    expect(incidentAwaitsAcknowledgement({ ...row, slaSnapshot: null })).toBe(
      false,
    );
    expect(
      incidentAwaitsAcknowledgement({ ...row, acknowledgedAt: at(1) }),
    ).toBe(false);
    expect(incidentAwaitsAcknowledgement({ ...row, status: "resolved" })).toBe(
      false,
    );
    expect(incidentAwaitsAcknowledgement({ ...row, closedAt: at(1) })).toBe(
      false,
    );
  });

  it("is not offered when status report updates meet the response", () => {
    expect(
      incidentAwaitsAcknowledgement({
        ...row,
        slaSnapshot: { ...snapshot, responseMet: "status_report" },
      }),
    ).toBe(false);
    expect(
      incidentAwaitsAcknowledgement({
        ...row,
        slaSnapshot: { ...snapshot, responseMet: "acknowledged" },
      }),
    ).toBe(true);
  });
});

const resolution = (incident: Partial<IncidentSlaFields>, now: Date) =>
  incidentSlaState({ ...base, ...incident }, now)?.resolution ?? null;

describe("miss reasons", () => {
  it("carries the reason of a recorded miss on its timer", () => {
    const state = incidentSlaState(
      {
        ...base,
        responseBreachDueAt: at(60),
        responseMissReason: "Pager rotation gap",
        resolutionMissReason: "Vendor outage",
        resolutionBreachDueAt: at(240),
      },
      at(300),
    );
    expect(state?.response?.missReason).toBe("Pager rotation gap");
    expect(state?.resolution?.missReason).toBe("Vendor outage");
  });

  it("hides a reason on a timer without a recorded miss", () => {
    expect(
      response({ responseMissReason: "stale" }, at(90))?.missReason,
    ).toBeNull();
  });
});

describe("resolution timer", () => {
  it("runs against the resolution target from the clock start", () => {
    expect(resolution({}, at(10))).toEqual({
      targetMinutes: 240,
      startsAt: declaredAt,
      dueAt: at(240),
      warnAt: at(180),
      metAt: null,
      breachDueAt: null,
      missReason: null,
      status: "running",
    });
    expect(resolution({}, at(180))?.status).toBe("at_risk");
    expect(resolution({}, new Date(at(240).getTime() + 1))?.status).toBe(
      "breached",
    );
  });

  it("is met at the stop time", () => {
    const timer = resolution(
      { status: "mitigated", resolutionStoppedAt: at(100) },
      at(900),
    );
    expect(timer?.status).toBe("met");
    expect(timer?.metAt).toEqual(at(100));
  });

  it("is breached once a miss is stamped, whatever the severity becomes", () => {
    const timer = resolution(
      {
        severity: "major",
        resolutionStoppedAt: at(300),
        resolutionBreachDueAt: at(240),
      },
      at(301),
    );
    expect(timer?.status).toBe("breached");
    expect(timer?.dueAt).toEqual(at(240));
  });

  it("runs against the original due time after a reopen", () => {
    expect(resolution({ resolutionStoppedAt: null }, at(200))?.dueAt).toEqual(
      at(240),
    );
    expect(resolution({ resolutionStoppedAt: null }, at(250))?.status).toBe(
      "breached",
    );
  });

  it("has no timer when the severity has no resolution target", () => {
    expect(resolution({ severity: "major" }, at(1))).toBeNull();
  });
});

describe("incidentResolutionPatch", () => {
  const mitigatedStop = base;
  const resolvedStop: IncidentSlaFields = {
    ...base,
    slaSnapshot: { ...snapshot, resolutionStop: "resolved" },
  };

  it("stops a mitigated-stop clock on mitigation and on a direct resolve", () => {
    expect(incidentResolutionPatch(mitigatedStop, "mitigated", at(30))).toEqual(
      { resolutionStoppedAt: at(30) },
    );
    expect(incidentResolutionPatch(mitigatedStop, "resolved", at(30))).toEqual({
      resolutionStoppedAt: at(30),
    });
  });

  it("keeps the stop time when a mitigated incident is resolved", () => {
    expect(
      incidentResolutionPatch(
        { ...mitigatedStop, status: "mitigated", resolutionStoppedAt: at(30) },
        "resolved",
        at(500),
      ),
    ).toEqual({});
  });

  it("does not stop a resolved-stop clock on mitigation", () => {
    expect(incidentResolutionPatch(resolvedStop, "mitigated", at(30))).toEqual(
      {},
    );
    expect(
      incidentResolutionPatch(
        { ...resolvedStop, status: "mitigated" },
        "resolved",
        at(90),
      ),
    ).toEqual({ resolutionStoppedAt: at(90) });
  });

  it("clears the stop time on returning to open", () => {
    expect(
      incidentResolutionPatch(
        { ...mitigatedStop, status: "mitigated", resolutionStoppedAt: at(30) },
        "open",
        at(60),
      ),
    ).toEqual({ resolutionStoppedAt: null });
    expect(
      incidentResolutionPatch(
        { ...resolvedStop, status: "mitigated" },
        "open",
        at(60),
      ),
    ).toEqual({});
  });

  it("judges a later mitigation at its own time after a failed one", () => {
    const reopened = { ...mitigatedStop, resolutionStoppedAt: null };
    expect(incidentResolutionPatch(reopened, "mitigated", at(241))).toEqual({
      resolutionStoppedAt: at(241),
      resolutionBreachDueAt: at(240),
    });
  });

  it("records the missed due time when the stop comes late", () => {
    expect(
      incidentResolutionPatch(mitigatedStop, "mitigated", at(240)),
    ).toEqual({ resolutionStoppedAt: at(240) });
    expect(incidentResolutionPatch(mitigatedStop, "resolved", at(300))).toEqual(
      {
        resolutionStoppedAt: at(300),
        resolutionBreachDueAt: at(240),
      },
    );
  });

  it("keeps an already stamped miss", () => {
    expect(
      incidentResolutionPatch(
        { ...mitigatedStop, resolutionBreachDueAt: at(240) },
        "mitigated",
        at(400),
      ),
    ).toEqual({ resolutionStoppedAt: at(400) });
  });

  it("stores the stop time even without a resolution target", () => {
    expect(
      incidentResolutionPatch(
        { ...mitigatedStop, severity: "major" },
        "mitigated",
        at(9),
      ),
    ).toEqual({ resolutionStoppedAt: at(9) });
  });

  it("sets nothing untracked or on cancel", () => {
    expect(
      incidentResolutionPatch(
        { ...mitigatedStop, slaSnapshot: null },
        "mitigated",
        at(2),
      ),
    ).toEqual({});
    expect(incidentResolutionPatch(mitigatedStop, "canceled", at(2))).toEqual(
      {},
    );
  });
});

describe("incidentSlaHeadline", () => {
  const headline = (incident: Partial<IncidentSlaFields>, now: Date) => {
    const state = incidentSlaState({ ...base, ...incident }, now);
    return state ? incidentSlaHeadline(state) : null;
  };

  it("picks the open timer due next", () => {
    expect(headline({}, at(10))?.kind).toBe("response");
    expect(headline({ responseMetAt: at(5) }, at(10))?.kind).toBe("resolution");
  });

  it("picks an open breached timer over a running one", () => {
    const h = headline({ responseMetAt: at(5) }, at(300));
    expect(h?.kind).toBe("resolution");
    expect(h?.timer.status).toBe("breached");
  });

  it("prefers a miss over a met timer once nothing is open", () => {
    expect(
      headline(
        {
          status: "mitigated",
          responseMetAt: at(90),
          responseBreachDueAt: at(60),
          resolutionStoppedAt: at(100),
        },
        at(200),
      )?.kind,
    ).toBe("response");
  });

  it("shows the resolution once both are met", () => {
    expect(
      headline(
        {
          status: "mitigated",
          responseMetAt: at(5),
          resolutionStoppedAt: at(100),
        },
        at(200),
      )?.kind,
    ).toBe("resolution");
  });

  it("is null without timers", () => {
    expect(headline({ severity: "major" }, at(1))).toBeNull();
  });
});

describe("reported at", () => {
  const reportedAt = at(-40);

  it("starts both timers, their warning points and due times", () => {
    const state = incidentSlaState({ ...base, reportedAt }, at(0));
    expect(state?.response).toMatchObject({
      startsAt: reportedAt,
      dueAt: at(20),
      warnAt: at(5),
      status: "running",
    });
    expect(state?.resolution).toMatchObject({
      startsAt: reportedAt,
      dueAt: at(200),
      warnAt: at(140),
    });
  });

  it("falls back to the declare time when cleared", () => {
    expect(response({ reportedAt: null }, at(0))?.startsAt).toEqual(declaredAt);
  });

  it("makes a meet at declare late once the response was already due", () => {
    expect(
      incidentResponsePatch({ ...base, reportedAt: at(-90) }, declaredAt),
    ).toEqual({ responseMetAt: declaredAt, responseBreachDueAt: at(-30) });
  });

  it("never re-judges a met response it moved past", () => {
    expect(
      response({ reportedAt: at(-90), responseMetAt: at(10) }, at(20))?.status,
    ).toBe("met");
  });
});
