import assert from "node:assert/strict";
import { isValidGradeSubmission } from "../lib/grade-submission-validation.mjs";

const sessionId = "11111111-1111-4111-8111-111111111111";
const sessionKey = "22222222-2222-4222-8222-222222222222";
const valid = { test_session_id: sessionId, test_session_key: sessionKey, answers: { 1: 0, 2: 3, 3: "" } };

assert.equal(isValidGradeSubmission(valid), true);
assert.equal(isValidGradeSubmission({ ...valid, answers: {} }), true);
assert.equal(isValidGradeSubmission({ ...valid, answers: { 1: "2" } }), true);
assert.equal(isValidGradeSubmission({ ...valid, answers: { 1: null } }), true);
assert.equal(isValidGradeSubmission({ ...valid, answers: { 0: 1 } }), false);
assert.equal(isValidGradeSubmission({ ...valid, answers: { 101: 1 } }), false);
assert.equal(isValidGradeSubmission({ ...valid, answers: { 1: 4 } }), false);
assert.equal(isValidGradeSubmission({ ...valid, answers: { 1: -1 } }), false);
assert.equal(isValidGradeSubmission({ ...valid, answers: { 1: "not-an-answer" } }), false);
assert.equal(isValidGradeSubmission({ ...valid, answers: [] }), false);
assert.equal(isValidGradeSubmission({ ...valid, test_session_key: "bad" }), false);
assert.equal(isValidGradeSubmission(null), false);

const tooManyAnswers = Object.fromEntries(Array.from({ length: 101 }, (_, index) => [String(index + 1), 0]));
assert.equal(isValidGradeSubmission({ ...valid, answers: tooManyAnswers }), false);

console.log("Grade submission validation tests passed.");
