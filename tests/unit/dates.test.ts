import { describe, expect, it } from "vitest";
import {
  DATE_INVALID_MESSAGE,
  dateInputToIso,
  getDateError,
  isRealDate,
  isValidIsoDate,
  isoToDateInput,
  localIsoDate,
  maskDate,
  maskDateInput,
  MONTH_FUTURE_MESSAGE,
  MONTH_INVALID_MESSAGE,
  MONTH_REQUIRED_MESSAGE,
  formatMonthLong,
  formatMonthShort,
  getMonthError,
  isFutureMonth,
  isRealMonth,
  isValidIsoMonth,
  isoToMonthInput,
  localIsoMonth,
  maskMonth,
  maskMonthInput,
  monthInputToIso,
} from "../../shared/format/dates.ts";

// AC-ra-28: the deadline field takes DD/MM/AAAA, refuses an impossible date and stores YYYY-MM-DD.
describe("date mask", () => {
  it("builds DD/MM/AAAA as the digits arrive and ignores everything that is not a digit", () => {
    expect(maskDate("")).toBe("");
    expect(maskDate("3")).toBe("3");
    expect(maskDate("31")).toBe("31");
    expect(maskDate("311")).toBe("31/1");
    expect(maskDate("3112")).toBe("31/12");
    expect(maskDate("31122")).toBe("31/12/2");
    expect(maskDate("31122026")).toBe("31/12/2026");
    expect(maskDate("31-12-2026 e mais")).toBe("31/12/2026");
    expect(maskDate("abc")).toBe("");
    expect(maskDate(null)).toBe("");
    expect(maskDate(undefined)).toBe("");
  });

  it("keeps the caret next to the digit just typed, even in the middle of the date", () => {
    expect(maskDateInput("311", 3)).toEqual({ value: "31/1", caret: 4 });
    expect(maskDateInput("31/122", 6)).toEqual({ value: "31/12/2", caret: 7 });
    // a digit inserted after the first one: the caret stays right after it, not at the end
    expect(maskDateInput("391/12/2026", 2)).toEqual({ value: "39/11/2202", caret: 2 });
  });

  it("removes the digit before a slash when Backspace is pressed over the slash", () => {
    expect(maskDateInput("31", 2, "31/")).toEqual({ value: "3", caret: 1 });
    expect(maskDateInput("3112", 2, "31/12")).toEqual({ value: "31/2", caret: 1 });
  });

  it("drops digits past the eighth", () => {
    expect(maskDateInput("311220269999", 12)).toEqual({ value: "31/12/2026", caret: 10 });
  });
});

describe("real dates", () => {
  it("knows the length of each month and leap years", () => {
    expect(isRealDate(2027, 2, 28)).toBe(true);
    expect(isRealDate(2027, 2, 29)).toBe(false);
    expect(isRealDate(2028, 2, 29)).toBe(true);
    expect(isRealDate(2100, 2, 29)).toBe(false);
    expect(isRealDate(2000, 2, 29)).toBe(true);
    expect(isRealDate(2026, 4, 30)).toBe(true);
    expect(isRealDate(2026, 4, 31)).toBe(false);
    expect(isRealDate(2026, 12, 31)).toBe(true);
  });

  it("refuses day zero, month 13, fractions, NaN and years outside the range", () => {
    expect(isRealDate(2026, 0, 10)).toBe(false);
    expect(isRealDate(2026, 13, 10)).toBe(false);
    expect(isRealDate(2026, 5, 0)).toBe(false);
    expect(isRealDate(2026, 5, 1.5)).toBe(false);
    expect(isRealDate(Number.NaN, 5, 1)).toBe(false);
    expect(isRealDate(Number.POSITIVE_INFINITY, 5, 1)).toBe(false);
    expect(isRealDate(1899, 5, 1)).toBe(false);
    expect(isRealDate(3000, 5, 1)).toBe(false);
  });

  it("validates the stored YYYY-MM-DD text", () => {
    expect(isValidIsoDate("2026-10-25")).toBe(true);
    expect(isValidIsoDate("2026-02-31")).toBe(false);
    expect(isValidIsoDate("2026-2-3")).toBe(false);
    expect(isValidIsoDate("25/10/2026")).toBe(false);
    expect(isValidIsoDate("2026-10-25T00:00:00Z")).toBe(false);
    expect(isValidIsoDate("")).toBe(false);
    expect(isValidIsoDate(null)).toBe(false);
    expect(isValidIsoDate(undefined)).toBe(false);
  });
});

describe("conversion between the field and the stored date", () => {
  it("turns a complete real DD/MM/AAAA into YYYY-MM-DD", () => {
    expect(dateInputToIso("25/10/2026")).toBe("2026-10-25");
    expect(dateInputToIso("25102026")).toBe("2026-10-25");
    expect(dateInputToIso("29/02/2028")).toBe("2028-02-29");
  });

  it("gives null for an incomplete, impossible or empty date", () => {
    expect(dateInputToIso("25/10/202")).toBeNull();
    expect(dateInputToIso("31/02/2027")).toBeNull();
    expect(dateInputToIso("29/02/2027")).toBeNull();
    expect(dateInputToIso("00/10/2026")).toBeNull();
    expect(dateInputToIso("10/13/2026")).toBeNull();
    expect(dateInputToIso("")).toBeNull();
    expect(dateInputToIso(null)).toBeNull();
    expect(dateInputToIso(undefined)).toBeNull();
  });

  it("turns the stored date back into what the field shows, and the round trip is the identity", () => {
    expect(isoToDateInput("2026-10-25")).toBe("25/10/2026");
    expect(isoToDateInput("2026-02-31")).toBe("");
    expect(isoToDateInput("not a date")).toBe("");
    expect(isoToDateInput(null)).toBe("");
    expect(dateInputToIso(isoToDateInput("2027-01-05"))).toBe("2027-01-05");
  });
});

describe("date field error on leaving the field", () => {
  it("accepts an empty field because the deadline is optional", () => {
    expect(getDateError("")).toBeNull();
    expect(getDateError(null)).toBeNull();
    expect(getDateError("//")).toBeNull();
  });

  it("accepts a complete real date", () => {
    expect(getDateError("25/10/2026")).toBeNull();
  });

  it("refuses an incomplete or impossible date with the field message", () => {
    expect(getDateError("25/10")).toBe(DATE_INVALID_MESSAGE);
    expect(getDateError("31/02/2027")).toBe(DATE_INVALID_MESSAGE);
    expect(DATE_INVALID_MESSAGE).toContain("DD/MM/AAAA");
  });
});

describe("local calendar date", () => {
  it("reads the computer's calendar day, not the UTC one", () => {
    expect(localIsoDate(new Date(2026, 9, 25, 23, 59, 59))).toBe("2026-10-25");
    expect(localIsoDate(new Date(2026, 0, 1, 0, 0, 0))).toBe("2026-01-01");
  });

  it("gives null for an invalid moment", () => {
    expect(localIsoDate(new Date(Number.NaN))).toBeNull();
  });
});

// AC-ra-38 and AC-ra-39: the diary month field takes MM/AAAA, refuses an impossible or future month
// and stores YYYY-MM.
describe("month mask", () => {
  it("builds MM/AAAA as the digits arrive and ignores everything that is not a digit", () => {
    expect(maskMonth("")).toBe("");
    expect(maskMonth("1")).toBe("1");
    expect(maskMonth("10")).toBe("10");
    expect(maskMonth("102")).toBe("10/2");
    expect(maskMonth("102026")).toBe("10/2026");
    expect(maskMonth("10-2026 e mais")).toBe("10/2026");
    expect(maskMonth("1020267")).toBe("10/2026");
    expect(maskMonth("abc")).toBe("");
    expect(maskMonth(null)).toBe("");
    expect(maskMonth(undefined)).toBe("");
  });

  it("keeps the caret next to the digit just typed and lets Backspace cross the slash", () => {
    expect(maskMonthInput("102", 3)).toEqual({ value: "10/2", caret: 4 });
    expect(maskMonthInput("10/2026", 7)).toEqual({ value: "10/2026", caret: 7 });
    // A digit typed in the middle of "10/2026" keeps the caret after it.
    expect(maskMonthInput("100/2026", 3, "10/2026")).toEqual({ value: "10/0202", caret: 4 });
    // Backspace right after the slash: the browser reports "102026" with the caret at 2 (separator
    // gone, same digits), so the digit before the slash goes instead of the field staying unchanged.
    expect(maskMonthInput("102026", 2, "10/2026")).toEqual({ value: "12/026", caret: 1 });
    // Deleting the last digit of a month shortens it normally.
    expect(maskMonthInput("10/202", 6, "10/2026")).toEqual({ value: "10/202", caret: 6 });
    expect(maskMonthInput("", 0, "1")).toEqual({ value: "", caret: 0 });
  });

  it("leaves the date mask as it was", () => {
    expect(maskDateInput("311", 3)).toEqual({ value: "31/1", caret: 4 });
    expect(maskDateInput("31122026", 8).value).toBe("31/12/2026");
  });
});

describe("real months", () => {
  it("accepts months 1 to 12 of a year inside the accepted range", () => {
    expect(isRealMonth(2026, 1)).toBe(true);
    expect(isRealMonth(2026, 12)).toBe(true);
    expect(isRealMonth(2026, 0)).toBe(false);
    expect(isRealMonth(2026, 13)).toBe(false);
    expect(isRealMonth(1899, 5)).toBe(false);
    expect(isRealMonth(3000, 5)).toBe(false);
    expect(isRealMonth(2026.5, 5)).toBe(false);
    expect(isRealMonth(Number.NaN, 5)).toBe(false);
  });

  it("checks the stored YYYY-MM text", () => {
    expect(isValidIsoMonth("2026-10")).toBe(true);
    expect(isValidIsoMonth("2026-13")).toBe(false);
    expect(isValidIsoMonth("2026-00")).toBe(false);
    expect(isValidIsoMonth("2026-1")).toBe(false);
    expect(isValidIsoMonth("2026-10-01")).toBe(false);
    expect(isValidIsoMonth("outubro")).toBe(false);
    expect(isValidIsoMonth(null)).toBe(false);
    expect(isValidIsoMonth(undefined)).toBe(false);
  });
});

describe("conversion between the month field and the stored month", () => {
  it("turns a complete real MM/AAAA into YYYY-MM", () => {
    expect(monthInputToIso("10/2026")).toBe("2026-10");
    expect(monthInputToIso("102026")).toBe("2026-10");
    expect(monthInputToIso("01/2020")).toBe("2020-01");
  });

  it("refuses an incomplete or impossible month", () => {
    expect(monthInputToIso("10/26")).toBeNull();
    expect(monthInputToIso("13/2026")).toBeNull();
    expect(monthInputToIso("00/2026")).toBeNull();
    expect(monthInputToIso("")).toBeNull();
    expect(monthInputToIso(null)).toBeNull();
  });

  it("turns the stored month back into what the field shows, and the round trip is the identity", () => {
    expect(isoToMonthInput("2026-10")).toBe("10/2026");
    expect(isoToMonthInput("2026-13")).toBe("");
    expect(isoToMonthInput("not a month")).toBe("");
    expect(isoToMonthInput(null)).toBe("");
    expect(monthInputToIso(isoToMonthInput("2027-01"))).toBe("2027-01");
  });
});

describe("future months", () => {
  it("reads the computer's calendar month, not the UTC one", () => {
    expect(localIsoMonth(new Date(2026, 9, 31, 23, 59, 59))).toBe("2026-10");
    expect(localIsoMonth(new Date(2026, 0, 1, 0, 0, 0))).toBe("2026-01");
    expect(localIsoMonth(new Date(Number.NaN))).toBeNull();
  });

  it("calls a month future only after the current one", () => {
    expect(isFutureMonth("2026-11", "2026-10")).toBe(true);
    expect(isFutureMonth("2027-01", "2026-10")).toBe(true);
    expect(isFutureMonth("2026-10", "2026-10")).toBe(false);
    expect(isFutureMonth("2026-09", "2026-10")).toBe(false);
    expect(isFutureMonth("garbage", "2026-10")).toBe(false);
    expect(isFutureMonth("2026-11", "garbage")).toBe(false);
  });
});

describe("month field error", () => {
  it("accepts the current month and any past month", () => {
    expect(getMonthError("10/2026", "2026-10")).toBeNull();
    expect(getMonthError("01/2020", "2026-10")).toBeNull();
  });

  it("refuses an empty field, because the month identifies the entry", () => {
    expect(getMonthError("", "2026-10")).toBe(MONTH_REQUIRED_MESSAGE);
    expect(getMonthError(null, "2026-10")).toBe(MONTH_REQUIRED_MESSAGE);
    expect(getMonthError("/", "2026-10")).toBe(MONTH_REQUIRED_MESSAGE);
  });

  it("refuses an incomplete or impossible month with the field message", () => {
    expect(getMonthError("10/26", "2026-10")).toBe(MONTH_INVALID_MESSAGE);
    expect(getMonthError("13/2026", "2026-10")).toBe(MONTH_INVALID_MESSAGE);
    expect(MONTH_INVALID_MESSAGE).toContain("MM/AAAA");
  });

  it("refuses a month that has not started yet", () => {
    expect(getMonthError("11/2026", "2026-10")).toBe(MONTH_FUTURE_MESSAGE);
    expect(getMonthError("01/2099", "2026-10")).toBe(MONTH_FUTURE_MESSAGE);
  });
});

describe("month names", () => {
  it("writes the month in full and in short for the list and the chart", () => {
    expect(formatMonthLong("2026-08")).toBe("agosto de 2026");
    expect(formatMonthLong("2026-03")).toBe("março de 2026");
    expect(formatMonthShort("2026-08")).toBe("ago/2026");
    expect(formatMonthShort("2026-12")).toBe("dez/2026");
  });

  it("gives an empty text for something that is not a real month, never undefined", () => {
    expect(formatMonthLong("2026-13")).toBe("");
    expect(formatMonthShort("garbage")).toBe("");
    expect(formatMonthShort(null)).toBe("");
  });
});
