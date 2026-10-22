import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

import { dayWindow } from "../day-window";

const ms = (iso: string) => new Date(iso).getTime();

describe("dayWindow", () => {
  test("runs from local midnight to the next local midnight", () => {
    expect(dayWindow("2026-10-16")).toEqual({
      start: ms("2026-10-16T00:00:00.000Z"),
      end: ms("2026-10-17T00:00:00.000Z"),
    });
    expect(dayWindow("2026-10-16T00:00:00.000Z", "Asia/Tokyo")).toEqual({
      start: ms("2026-10-15T15:00:00.000Z"),
      end: ms("2026-10-16T15:00:00.000Z"),
    });
  });

  test("handles offsets that are not whole hours", () => {
    expect(dayWindow("2026-10-16", "Asia/Kolkata").start).toBe(
      ms("2026-10-15T18:30:00.000Z"),
    );
    expect(dayWindow("2026-10-16", "America/St_Johns").start).toBe(
      ms("2026-10-16T02:30:00.000Z"),
    );
  });

  test("follows the offset change on the days summer time starts and ends", () => {
    // Berlin leaves summer time on 2026-10-25 and enters it on 2026-03-29
    const fallBack = dayWindow("2026-10-25", "Europe/Berlin");
    expect(fallBack).toEqual({
      start: ms("2026-10-24T22:00:00.000Z"),
      end: ms("2026-10-25T23:00:00.000Z"),
    });
    const springForward = dayWindow("2026-03-29", "Europe/Berlin");
    expect(springForward.end - springForward.start).toBe(23 * 3_600_000);
  });

  test("starts at the first wall-clock time when midnight is skipped", () => {
    // Santiago jumps from 00:00 to 01:00 on 2026-09-06
    expect(dayWindow("2026-09-06", "America/Santiago").start).toBe(
      ms("2026-09-06T04:00:00.000Z"),
    );
  });
});
