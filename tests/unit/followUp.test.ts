import { describe, expect, it } from "vitest";
import {
  DEFAULT_REEVALUATION_DAYS,
  REEVALUATION_INTERVAL_OPTIONS,
  addDaysToIsoDate,
  daysBetweenIsoDates,
  formatDays,
  isReevaluationInterval,
  reevaluationCountdown,
  reevaluationOf,
  reevaluationTimeline,
} from "../../shared/domain/followUp.ts";

// RULE-ra-07 (AC-ra-15): the date of the next diagnosis is the local day of the last one plus the
// interval, and it is late once that day has passed. Every moment below is built from local calendar
// parts (`new Date(year, monthIndex, day, hour, ...)`), so the cases mean the same in any time zone.

const local = (year: number, month: number, day: number, hour = 12, minute = 0, second = 0): Date =>
  new Date(year, month - 1, day, hour, minute, second);

describe("reevaluation intervals", () => {
  it("defaults to 90 days and offers 60, 90, 120 and 180", () => {
    expect(DEFAULT_REEVALUATION_DAYS).toBe(90);
    expect([...REEVALUATION_INTERVAL_OPTIONS]).toEqual([60, 90, 120, 180]);
    expect(REEVALUATION_INTERVAL_OPTIONS).toContain(DEFAULT_REEVALUATION_DAYS);
  });

  it("recognizes only the four offered intervals", () => {
    for (const option of REEVALUATION_INTERVAL_OPTIONS) {
      expect(isReevaluationInterval(option)).toBe(true);
    }
    for (const other of [0, 30, 45, 91, 365, -90, 90.5, "90", null, undefined, Number.NaN]) {
      expect(isReevaluationInterval(other)).toBe(false);
    }
  });
});

describe("calendar days", () => {
  it("adds days across months, years and leap days", () => {
    expect(addDaysToIsoDate("2026-07-25", 90)).toBe("2026-10-23");
    expect(addDaysToIsoDate("2026-10-23", 90)).toBe("2027-01-21");
    expect(addDaysToIsoDate("2027-12-31", 1)).toBe("2028-01-01");
    expect(addDaysToIsoDate("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDaysToIsoDate("2027-02-28", 1)).toBe("2027-03-01");
    expect(addDaysToIsoDate("2026-10-23", 0)).toBe("2026-10-23");
    expect(addDaysToIsoDate("2026-10-23", -23)).toBe("2026-09-30");
  });

  it("answers null instead of throwing for a date or an amount that is not real", () => {
    expect(addDaysToIsoDate("2026-02-30", 1)).toBeNull();
    expect(addDaysToIsoDate("23/10/2026", 1)).toBeNull();
    expect(addDaysToIsoDate("", 1)).toBeNull();
    expect(addDaysToIsoDate("2026-10-23", 1.5)).toBeNull();
    expect(addDaysToIsoDate("2026-10-23", Number.NaN)).toBeNull();
    expect(addDaysToIsoDate("2026-10-23", Number.POSITIVE_INFINITY)).toBeNull();
    expect(addDaysToIsoDate("2026-10-23", 10_000_000_000)).toBeNull();
    expect(addDaysToIsoDate("2999-12-31", 1)).toBeNull();
  });

  it("counts the days between two dates, negative when the second comes first", () => {
    expect(daysBetweenIsoDates("2026-07-25", "2026-10-23")).toBe(90);
    expect(daysBetweenIsoDates("2026-10-23", "2026-10-23")).toBe(0);
    expect(daysBetweenIsoDates("2026-10-23", "2026-07-25")).toBe(-90);
    // 365 days to 28/02/2028, plus the leap day.
    expect(daysBetweenIsoDates("2027-02-28", "2028-03-01")).toBe(367);
    expect(daysBetweenIsoDates("2026-10-23", "not a date")).toBeNull();
    expect(daysBetweenIsoDates("2026-13-01", "2026-10-23")).toBeNull();
  });
});

describe("reevaluationOf", () => {
  it("sets the due date at the local day of the diagnosis plus the interval", () => {
    const diagnosedAt = local(2026, 7, 25);

    expect(reevaluationOf(diagnosedAt, local(2026, 8, 1))?.dueDate).toBe("2026-10-23");
    for (const [interval, dueDate] of [
      [60, "2026-09-23"],
      [90, "2026-10-23"],
      [120, "2026-11-22"],
      [180, "2027-01-21"],
    ] as const) {
      expect(reevaluationOf(diagnosedAt, local(2026, 8, 1), interval)?.dueDate, `${interval} days`).toBe(dueDate);
    }
  });

  it("uses 90 days when no interval is given", () => {
    expect(reevaluationOf(local(2026, 7, 25), local(2026, 8, 1))).toEqual(
      reevaluationOf(local(2026, 7, 25), local(2026, 8, 1), DEFAULT_REEVALUATION_DAYS),
    );
  });

  it("counts the days until the due date and is on time until the due day ends", () => {
    const diagnosedAt = local(2026, 7, 25);

    expect(reevaluationOf(diagnosedAt, local(2026, 7, 25))).toEqual({
      dueDate: "2026-10-23",
      daysSince: 0,
      daysUntil: 90,
      late: false,
      daysLate: 0,
    });
    expect(reevaluationOf(diagnosedAt, local(2026, 10, 22))).toMatchObject({ daysUntil: 1, late: false, daysLate: 0 });
    // On the due day itself the company is still on time.
    expect(reevaluationOf(diagnosedAt, local(2026, 10, 23))).toMatchObject({ daysSince: 90, daysUntil: 0, late: false, daysLate: 0 });
    expect(reevaluationOf(diagnosedAt, local(2026, 10, 24))).toMatchObject({ daysSince: 91, daysUntil: -1, late: true, daysLate: 1 });
    expect(reevaluationOf(diagnosedAt, local(2027, 1, 21))).toMatchObject({ daysSince: 180, daysUntil: -90, late: true, daysLate: 90 });
  });

  it("is late after the due date for each interval and on time before it", () => {
    const diagnosedAt = local(2026, 1, 10);

    for (const interval of REEVALUATION_INTERVAL_OPTIONS) {
      const dueDate = reevaluationOf(diagnosedAt, diagnosedAt, interval)?.dueDate as string;
      const [year, month, day] = dueDate.split("-").map(Number);
      const onTheDay = reevaluationOf(diagnosedAt, local(year, month, day), interval);
      const nextDay = reevaluationOf(diagnosedAt, local(year, month, day + 1), interval);

      expect(onTheDay, `${interval} days, due day`).toMatchObject({ late: false, daysLate: 0 });
      expect(nextDay, `${interval} days, day after`).toMatchObject({ late: true, daysLate: 1 });
    }
  });

  // The day turns at local midnight: what matters is the calendar date, not the hours in between.
  it("turns late at the local midnight after the due day, not 24 hours after the diagnosis", () => {
    const diagnosedAt = local(2026, 7, 25, 23, 59);

    expect(reevaluationOf(diagnosedAt, local(2026, 10, 23, 23, 59, 59))).toMatchObject({ late: false, daysUntil: 0 });
    expect(reevaluationOf(diagnosedAt, local(2026, 10, 24, 0, 0, 0))).toMatchObject({ late: true, daysLate: 1 });
  });

  it("reads a diagnosis made just after midnight as that new day", () => {
    const justAfter = local(2026, 7, 26, 0, 1);
    const justBefore = local(2026, 7, 25, 23, 59);

    expect(reevaluationOf(justAfter, local(2026, 8, 1))?.dueDate).toBe("2026-10-24");
    expect(reevaluationOf(justBefore, local(2026, 8, 1))?.dueDate).toBe("2026-10-23");
  });

  it("counts calendar days, not hours: two hours across midnight are one day", () => {
    expect(reevaluationOf(local(2026, 1, 1, 23, 0), local(2026, 1, 2, 1, 0))).toMatchObject({ daysSince: 1, daysUntil: 89 });
    expect(reevaluationOf(local(2026, 1, 1, 0, 0), local(2026, 1, 1, 23, 59, 59))).toMatchObject({ daysSince: 0, daysUntil: 90 });
  });

  it("changes the verdict when the interval changes", () => {
    const diagnosedAt = local(2026, 7, 25);
    const today = local(2026, 11, 1);

    expect(reevaluationOf(diagnosedAt, today, 90)).toMatchObject({ late: true, daysLate: 9 });
    expect(reevaluationOf(diagnosedAt, today, 120)).toMatchObject({ late: false, daysUntil: 21 });
  });

  it("answers null for an invalid moment or an interval that is not a whole number of days", () => {
    const valid = local(2026, 7, 25);

    expect(reevaluationOf(new Date(Number.NaN), valid)).toBeNull();
    expect(reevaluationOf(valid, new Date(Number.NaN))).toBeNull();
    for (const interval of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(reevaluationOf(valid, valid, interval), String(interval)).toBeNull();
    }
  });
});

// AC-ra-33: the home counts "N dias até {data}" while on time and "N dias de atraso desde {data}" once
// the due day has passed, with the Último / Hoje / Próximo line under it (prototype: reevaluation-countdown).
describe("formatDays", () => {
  it("writes the unit after the number: one day is singular, zero and the rest are plural", () => {
    expect(formatDays(0)).toBe("0 dias");
    expect(formatDays(1)).toBe("1 dia");
    expect(formatDays(2)).toBe("2 dias");
    expect(formatDays(180)).toBe("180 dias");
  });

  it("answers null for an amount that is not a whole number of days", () => {
    for (const days of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(formatDays(days), String(days)).toBeNull();
    }
  });
});

describe("reevaluationCountdown", () => {
  const diagnosedAt = local(2026, 7, 25);

  it("says how many days are left until the due date (AC-ra-33)", () => {
    const reevaluation = reevaluationOf(diagnosedAt, local(2026, 8, 1));

    expect(reevaluation && reevaluationCountdown(reevaluation)).toEqual({
      amount: "83 dias",
      relation: "até 23/10/2026",
      text: "83 dias até 23/10/2026",
    });
  });

  it("uses the singular for the last day but one and counts zero days on the due day itself", () => {
    const dayBefore = reevaluationOf(diagnosedAt, local(2026, 10, 22));
    const dueDay = reevaluationOf(diagnosedAt, local(2026, 10, 23));

    expect(dayBefore && reevaluationCountdown(dayBefore)?.text).toBe("1 dia até 23/10/2026");
    expect(dueDay && reevaluationCountdown(dueDay)?.text).toBe("0 dias até 23/10/2026");
  });

  it("says how many days late once the due date has passed (AC-ra-33)", () => {
    const dayAfter = reevaluationOf(diagnosedAt, local(2026, 10, 24));
    const lateBy9 = reevaluationOf(diagnosedAt, local(2026, 11, 1));

    expect(dayAfter && reevaluationCountdown(dayAfter)).toEqual({
      amount: "1 dia",
      relation: "de atraso desde 23/10/2026",
      text: "1 dia de atraso desde 23/10/2026",
    });
    expect(lateBy9 && reevaluationCountdown(lateBy9)?.text).toBe("9 dias de atraso desde 23/10/2026");
  });

  it("follows the chosen interval: the same day counts down or up depending on it (AC-ra-34)", () => {
    const today = local(2026, 11, 1);
    const texts = REEVALUATION_INTERVAL_OPTIONS.map((interval) => {
      const reevaluation = reevaluationOf(diagnosedAt, today, interval);
      return reevaluation && reevaluationCountdown(reevaluation)?.text;
    });

    expect(texts).toEqual([
      "39 dias de atraso desde 23/09/2026",
      "9 dias de atraso desde 23/10/2026",
      "21 dias até 22/11/2026",
      "81 dias até 21/01/2027",
    ]);
  });

  it("answers null for a reevaluation that does not hold real days", () => {
    expect(reevaluationCountdown({ dueDate: "2026-02-30", daysUntil: 3, late: false, daysLate: 0 })).toBeNull();
    expect(reevaluationCountdown({ dueDate: "", daysUntil: 3, late: false, daysLate: 0 })).toBeNull();
    expect(reevaluationCountdown({ dueDate: "2026-10-23", daysUntil: Number.NaN, late: false, daysLate: 0 })).toBeNull();
    expect(reevaluationCountdown({ dueDate: "2026-10-23", daysUntil: -2, late: true, daysLate: 1.5 })).toBeNull();
  });
});

describe("reevaluationTimeline", () => {
  it("writes the last diagnosis, today and the next one as DD/MM/AAAA in one line (AC-ra-33)", () => {
    expect(reevaluationTimeline("2026-07-25", "2026-08-01", "2026-10-23")).toEqual({
      last: "25/07/2026",
      today: "01/08/2026",
      next: "23/10/2026",
      text: "Último: 25/07/2026 · Hoje: 01/08/2026 · Próximo: 23/10/2026",
    });
  });

  it("is built from the days reevaluationOf counted", () => {
    const reevaluation = reevaluationOf(local(2026, 7, 25), local(2026, 8, 1), 120);

    expect(reevaluation && reevaluationTimeline("2026-07-25", "2026-08-01", reevaluation.dueDate)?.next).toBe("22/11/2026");
  });

  it("answers null unless the three days are real dates", () => {
    expect(reevaluationTimeline("", "2026-08-01", "2026-10-23")).toBeNull();
    expect(reevaluationTimeline("2026-07-25", "01/08/2026", "2026-10-23")).toBeNull();
    expect(reevaluationTimeline("2026-07-25", "2026-08-01", "2026-02-30")).toBeNull();
  });
});
