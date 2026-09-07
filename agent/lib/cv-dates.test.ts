/** `node agent/lib/cv-dates.test.ts` */
import assert from "node:assert/strict";
import { displayDate, withDisplayDates } from "./cv-dates.ts";
import type { Cv } from "./cv-schema.ts";

assert.equal(displayDate("2024-11-01T00:00:00.000Z", "en"), "Nov 2024");
assert.equal(displayDate("2024-11", "en"), "Nov 2024");
assert.equal(displayDate("2024-11-01T00:00:00.000Z", "fr"), "nov. 2024");
assert.equal(displayDate("Nov 2024", "en"), "Nov 2024"); // already a display date
assert.equal(displayDate("", "en"), ""); // "" means "still held"
assert.equal(displayDate("Present", "en"), "Present");

const cv = withDisplayDates(
  {
    experiences: [{ start: "2022-07-01T00:00:00.000Z", end: "" }],
    education: [{ dates: "2019-09-01T00:00:00.000Z – 2022-06-30T00:00:00.000Z" }],
  } as unknown as Cv,
  "en",
);
assert.deepEqual(cv.experiences[0], { start: "Jul 2022", end: "" });
assert.equal(cv.education[0].dates, "Sep 2019 – Jun 2022");

console.log("cv-dates: all checks passed");
