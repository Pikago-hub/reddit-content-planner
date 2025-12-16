import { describe, it, expect, vi } from "vitest";

vi.mock("../../supabase", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
    })),
  },
}));

vi.mock("../../openai", () => ({
  openai: {
    responses: {
      create: vi.fn(),
    },
  },
}));

import { getNextWeekStart, getCurrentWeekStart } from "../index";

describe("getNextWeekStart", () => {
  it("returns next Monday from a Wednesday", () => {
    // Wednesday, December 17, 2025
    const wednesday = new Date("2025-12-17T15:30:00Z");
    const result = getNextWeekStart(wednesday);

    // Should be Monday, December 22, 2025
    expect(result.getUTCFullYear()).toBe(2025);
    expect(result.getUTCMonth()).toBe(11); // December
    expect(result.getUTCDate()).toBe(22);
    expect(result.getUTCDay()).toBe(1); // Monday
  });

  it("returns next Monday from a Sunday", () => {
    // Sunday, December 21, 2025
    const sunday = new Date("2025-12-21T10:00:00Z");
    const result = getNextWeekStart(sunday);

    // Should be Monday, December 22, 2025 (the next day)
    expect(result.getUTCDate()).toBe(22);
    expect(result.getUTCDay()).toBe(1); // Monday
  });

  it("returns Monday of next week from a Monday", () => {
    // Monday, December 15, 2025
    const monday = new Date("2025-12-15T10:00:00Z");
    const result = getNextWeekStart(monday);

    // Should be Monday, December 22, 2025 (not the same day)
    expect(result.getUTCDate()).toBe(22);
    expect(result.getUTCDay()).toBe(1);
  });

  it("sets time to midnight UTC", () => {
    const date = new Date("2025-12-17T15:30:45Z");
    const result = getNextWeekStart(date);

    expect(result.getUTCHours()).toBe(0);
    expect(result.getUTCMinutes()).toBe(0);
    expect(result.getUTCSeconds()).toBe(0);
    expect(result.getUTCMilliseconds()).toBe(0);
  });

  it("handles year boundary correctly", () => {
    // Friday, December 26, 2025
    const friday = new Date("2025-12-26T10:00:00Z");
    const result = getNextWeekStart(friday);

    // Should be Monday, December 29, 2025
    expect(result.getUTCFullYear()).toBe(2025);
    expect(result.getUTCMonth()).toBe(11);
    expect(result.getUTCDate()).toBe(29);
    expect(result.getUTCDay()).toBe(1);
  });
});

describe("getCurrentWeekStart", () => {
  it("returns current Monday from a Wednesday", () => {
    // Wednesday, December 17, 2025
    const wednesday = new Date("2025-12-17T15:30:00Z");
    const result = getCurrentWeekStart(wednesday);

    // Should be Monday, December 15, 2025
    expect(result.getUTCFullYear()).toBe(2025);
    expect(result.getUTCMonth()).toBe(11); // December
    expect(result.getUTCDate()).toBe(15);
    expect(result.getUTCDay()).toBe(1); // Monday
  });

  it("returns same day when given a Monday", () => {
    // Monday, December 15, 2025
    const monday = new Date("2025-12-15T10:00:00Z");
    const result = getCurrentWeekStart(monday);

    // Should be the same Monday
    expect(result.getUTCDate()).toBe(15);
    expect(result.getUTCDay()).toBe(1);
  });

  it("returns previous Monday from a Sunday", () => {
    // Sunday, December 21, 2025
    const sunday = new Date("2025-12-21T10:00:00Z");
    const result = getCurrentWeekStart(sunday);

    // Should be Monday, December 15, 2025 (previous Monday)
    expect(result.getUTCDate()).toBe(15);
    expect(result.getUTCDay()).toBe(1);
  });

  it("sets time to midnight UTC", () => {
    const date = new Date("2025-12-17T15:30:45Z");
    const result = getCurrentWeekStart(date);

    expect(result.getUTCHours()).toBe(0);
    expect(result.getUTCMinutes()).toBe(0);
    expect(result.getUTCSeconds()).toBe(0);
    expect(result.getUTCMilliseconds()).toBe(0);
  });

  it("handles month boundary correctly", () => {
    // Wednesday, December 3, 2025
    const wednesday = new Date("2025-12-03T10:00:00Z");
    const result = getCurrentWeekStart(wednesday);

    // Should be Monday, December 1, 2025
    expect(result.getUTCFullYear()).toBe(2025);
    expect(result.getUTCMonth()).toBe(11); // December
    expect(result.getUTCDate()).toBe(1);
    expect(result.getUTCDay()).toBe(1);
  });

  it("handles cross-month boundary", () => {
    // Tuesday, December 2, 2025 - week started in previous month
    const tuesday = new Date("2025-12-02T10:00:00Z");
    const result = getCurrentWeekStart(tuesday);

    // Should be Monday, December 1, 2025
    expect(result.getUTCFullYear()).toBe(2025);
    expect(result.getUTCMonth()).toBe(11); // December
    expect(result.getUTCDate()).toBe(1);
  });
});
