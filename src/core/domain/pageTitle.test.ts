import { describe, expect, it } from "vitest";
import { screenKeyFor } from "./pageTitle";

describe("screenKeyFor", () => {
  it.each([
    ["/app", "home"],
    ["/app/doctors", "doctors"],
    ["/app/doctors/doc_meera", "booking"],
    ["/app/token/tok_1", "token"],
    ["/app/reports", "reports"],
    ["/app/reports/upload", "reportUpload"],
    ["/app/reports/rep_1/review", "reportReview"],
    ["/app/reports/rep_1", "reportExplain"],
    ["/hospital/booking-modes", "hospitalModes"],
    ["/hospital", "hospitalOverview"],
  ])("%s is %s", (path, key) => expect(screenKeyFor(path)).toBe(key));

  it("returns nothing for an unknown path", () => {
    expect(screenKeyFor("/somewhere")).toBeNull();
  });
});
