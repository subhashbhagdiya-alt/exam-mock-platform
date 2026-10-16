import assert from "node:assert/strict";
import { dedupeGeneratedQuestions, normalizeQuestionText, validateGeneratedQuestion } from "../lib/weekly-exam-analysis.mjs";

const valid = {
  subject: "Reasoning",
  topic: "Number series",
  question_hi: "श्रृंखला में अगली संख्या क्या है: 2, 4, 8, 16, ?",
  question_en: "What is the next number in the series: 2, 4, 8, 16, ?",
  options: ["24", "30", "32", "34"],
  answer_index: 2,
  explanation_hi: "हर संख्या पिछली संख्या की दोगुनी है, इसलिए अगली संख्या 32 है।",
  explanation_en: "Each number doubles, so the next number is 32.",
  difficulty: "easy",
};

assert.equal(validateGeneratedQuestion(valid), true);
assert.equal(validateGeneratedQuestion({ ...valid, answer_index: 4 }), false);
assert.equal(validateGeneratedQuestion({ ...valid, options: ["same", "same", "same", "same"] }), false);
assert.equal(validateGeneratedQuestion({ ...valid, options: ["A", " a ", "B", "C"] }), false);
assert.equal(validateGeneratedQuestion({ ...valid, explanation_hi: "" }), false);
assert.equal(validateGeneratedQuestion({ ...valid, question_en: "x".repeat(1201) }), false);
assert.equal(validateGeneratedQuestion({ ...valid, subject: "Reasoning\\u0000" }), false);
assert.equal(validateGeneratedQuestion({ ...valid, question_en: "<script>alert(1)</script>" }), false);
assert.equal(validateGeneratedQuestion([]), false);
assert.equal(normalizeQuestionText("  What IS 2+2? "), "what is 2 2");

const candidates = [
  valid,
  { ...valid, question_en: "WHAT IS THE NEXT NUMBER IN THE SERIES: 2, 4, 8, 16, ?" },
  { ...valid, question_hi: "एक बिल्कुल नया हिंदी प्रश्न", question_en: "A completely different question" },
  { ...valid, question_en: "A bad question", answer_index: 8 },
  { ...valid, question_en: "An oversized question " + "x".repeat(1300) },
];
const unique = dedupeGeneratedQuestions(candidates, ["What is the next number in the series: 2, 4, 8, 16, ?"], []);
assert.equal(unique.length, 1);
assert.equal(unique[0].question_en, "A completely different question");

console.log("Weekly exam analysis validation tests passed.");
