import assert from "node:assert/strict";
import {
  dedupeQuestionRows,
  getLocalizedQuestionOptions,
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
