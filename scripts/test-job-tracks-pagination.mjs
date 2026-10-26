import assert from "node:assert/strict";
import { fetchAllRowsInPages } from "../lib/fetch-all-rows-in-pages.mjs";

const sourceRows = Array.from({ length: 2305 }, (_, index) => ({ id: index + 1 }));
const ranges = [];
const result = await fetchAllRowsInPages(async (from, to) => {
  ranges.push([from, to]);
  // Simulate a Supabase server cap below the requested range size.
  return {
    data: sourceRows.slice(from, Math.min(to + 1, from + 500)),
    count: sourceRows.length,
    error: null
  };
});
assert.equal(result.error, null);
assert.equal(result.data.length, sourceRows.length);
assert.deepEqual(result.data.map(row => row.id), sourceRows.map(row => row.id));
assert.deepEqual(ranges.map(([from]) => from), [0, 500, 1000, 1500, 2000]);
assert.ok(ranges.every(([from, to]) => to - from + 1 === 1000));

const empty = await fetchAllRowsInPages(async () => ({ data: [], count: 0, error: null }));
assert.deepEqual(empty, { data: [], error: null });

const upstreamError = new Error("database unavailable");
const failed = await fetchAllRowsInPages(async () => ({ data: null, count: null, error: upstreamError }));
assert.equal(failed.data, null);
assert.equal(failed.error, upstreamError);

const shortPage = await fetchAllRowsInPages(async () => ({ data: [], count: 10, error: null }));
assert.equal(shortPage.data, null);
assert.match(shortPage.error.message, /ended before its exact row count/);

console.log("Question-bank pagination checks passed: row-cap handling, stable offsets, empty result, and error propagation.");
