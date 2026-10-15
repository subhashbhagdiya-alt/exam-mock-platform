import assert from "node:assert/strict";
import { validateResultQuestionMapping } from "../lib/result-validation.mjs";

const q1 = "11111111-1111-4111-8111-111111111111";
const q2 = "22222222-2222-4222-8222-222222222222";

assert.deepEqual(validateResultQuestionMapping({ 1: q1, 2: q2 }, 2), [q1, q2]);
assert.deepEqual(validateResultQuestionMapping({ 1: q1.toUpperCase() }, 1), [q1]);
assert.throws(() => validateResultQuestionMapping({ 1: q1, 2: q1 }, 2), /Duplicate question ids/);
assert.throws(() => validateResultQuestionMapping({ 1: q1 }, 2), /Question count/);
assert.throws(() => validateResultQuestionMapping({ 1: "not-a-uuid" }, 1), /Invalid question mapping/);
assert.throws(() => validateResultQuestionMapping({}, 0), /Invalid question mapping/);
assert.throws(
  () => validateResultQuestionMapping(Object.fromEntries(Array.from({ length: 101 }, (_, i) => [i, `0000000${i+1}-1111-4111-8111-111111111111`])), 101),
  /Invalid question mapping/
);

console.log("Result question mapping validation tests passed.");
