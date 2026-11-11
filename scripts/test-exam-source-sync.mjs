import assert from "node:assert/strict";
import { formatSourceFetchError, mapWithConcurrency } from "../lib/exam-source-sync.mjs";

const values = Array.from({ length: 25 }, (_, i) => i);
let active = 0;
let maximumActive = 0;
const ordered = await mapWithConcurrency(values, 4, async (value) => {
  active += 1;
  maximumActive = Math.max(maximumActive, active);
  await new Promise(resolve => setTimeout(resolve, (value % 4) + 1));
  active -= 1;
  return value * 2;
});
assert.equal(maximumActive, 4, "Source fetch concurrency should respect the configured cap.");
assert.deepEqual(ordered, values.map(value => value * 2), "Concurrent mapping should preserve source order.");

assert.deepEqual(await mapWithConcurrency([], 5, async value => value), []);
assert.deepEqual(await mapWithConcurrency([1, 2, 3], 0, async value => value + 1), [2, 3, 4]);
await assert.rejects(() => mapWithConcurrency([1], 1, null), /mapper must be a function/);
await assert.rejects(() => mapWithConcurrency([1], 1, async () => { throw new Error("worker failed"); }), /worker failed/);

const error = new Error("fetch failed", { cause: Object.assign(new Error("connect reset"), { code: "ECONNRESET" }) });
assert.match(formatSourceFetchError(error), /fetch failed/);
assert.match(formatSourceFetchError(error), /ECONNRESET/);
assert.equal(formatSourceFetchError(new Error("timeout")).includes("timeout"), true);
assert.ok(formatSourceFetchError({}).length > 0);
assert.ok(formatSourceFetchError({ message: "x".repeat(700) }).length <= 500);

console.log("Exam source concurrency and error-detail tests passed.");
