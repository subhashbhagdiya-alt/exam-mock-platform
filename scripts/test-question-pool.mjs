import assert from "node:assert/strict";
import {
  dedupeQuestionRows,
  getLocalizedQuestionOptions,
  getCorrectQuestionSourceIds,
  mergeQuestionIds,
  normalizeQuestionText,
} from "../lib/question-pool.mjs";

const rows = [
  { id: "one", question_en: "What is the SI unit of power?", question_hi: "शक्ति की SI इकाई क्या है?" },
  { id: "duplicate", question_en: "What is the SI unit of power?", question_hi: "विद्युत शक्ति की SI इकाई क्या है?" },
  { id: "math-a", question_en: "Solve: P < Q < F = R", question_hi: "हल करें: P < Q < F = R" },
  { id: "math-b", question_en: "Solve: P ≤ Q < F = R", question_hi: "हल करें: P ≤ Q < F = R" },
];
assert.deepEqual(dedupeQuestionRows(rows).map(row => row.id), ["one", "math-a", "math-b"]);

const competingCopies = [
  { id: "curated-copy", source_type: "curated", question_en: "Same question?", question_hi: "एक जैसा सवाल?", explanation_hi: "छोटी", explanation_en: "Short" },
  { id: "official-copy", source_type: "official", question_en: "Same question?", question_hi: "एक जैसा सवाल?", explanation_hi: "Official explanation", explanation_en: "Official explanation" },
];
assert.deepEqual(dedupeQuestionRows(competingCopies).map(row => row.id), ["official-copy"]);
assert.equal(normalizeQuestionText("  25% of a number is 45? "), "25%ofanumberis45");
assert.notEqual(normalizeQuestionText("P < Q"), normalizeQuestionText("P ≤ Q"));
assert.deepEqual(mergeQuestionIds(["11111111-1111-4111-8111-111111111111"], ["11111111-1111-4111-8111-111111111111", "invalid"]), ["11111111-1111-4111-8111-111111111111"]);
assert.deepEqual(getLocalizedQuestionOptions({ options: ["रबी / Rabi", "1/2", "नाइट्रोजन / Nitrogen", "चार / Four"] }, "hi"), ["रबी", "1/2", "नाइट्रोजन", "चार"]);
assert.deepEqual(getLocalizedQuestionOptions({ options: ["रबी / Rabi", "1/2", "नाइट्रोजन / Nitrogen", "चार / Four"] }, "en"), ["Rabi", "1/2", "Nitrogen", "Four"]);
assert.deepEqual(getLocalizedQuestionOptions({ options: ["A", "B", "C", "D"], optionsHi: ["क", "ख", "ग", "घ"] }, "hi"), ["क", "ख", "ग", "घ"]);
console.log("Question-pool deduplication, seen-ID merging and question-language tests passed.");


const q1 = "11111111-1111-4111-8111-111111111111";
const q2 = "22222222-2222-4222-8222-222222222222";
const q3 = "33333333-3333-4333-8333-333333333333";
const q4 = "44444444-4444-4444-8444-444444444444";
const mastery = getCorrectQuestionSourceIds(
  [
    { id: 1, answer: 2 },
    { id: 2, answer: 1 },
    { id: 3, answer: 0 },
    { id: 4, answer: 3 },
    { id: 5, answer: 1 },
  ],
  { 1: 2, 2: 3, 3: "0", 4: null, 5: "not-an-answer" },
  [
    { id: 1, sourceId: q1 },
    { id: 2, sourceId: q2 },
    { id: 3, sourceId: q3 },
    { id: 4, sourceId: q4 },
    { id: 5, sourceId: "invalid-id" },
  ]
);
assert.deepEqual(mastery, [q1, q3], "Only correct answers should be mastered; wrong, skipped and invalid answers must remain available.");
assert.deepEqual(getCorrectQuestionSourceIds([{ id: 1, answer: 0 }], {}, [{ id: 1, sourceId: q1 }]), []);
assert.deepEqual(getCorrectQuestionSourceIds([{ id: 1, answer: 0 }], { 1: 0 }, [{ id: 1, sourceId: q1 }, { id: 1, sourceId: q1 }]), [q1]);
assert.deepEqual(getCorrectQuestionSourceIds(null, { 1: 0 }, [{ id: 1, sourceId: q1 }]), []);
console.log("Correct-answer-only question mastery tests passed.");
