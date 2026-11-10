import assert from "node:assert/strict";
import { buildWeeklyEvidence, dedupeGeneratedQuestions, normalizeQuestionText, takeWeeklyReviewBatch, WEEKLY_REVIEW_BATCH_SIZE, validateGeneratedQuestion } from "../lib/weekly-exam-analysis.mjs";

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
assert.equal(validateGeneratedQuestion({ ...valid, explanation_hi: "" }), false);
assert.equal(validateGeneratedQuestion({ ...valid, options: ["A", " a ", "B", "C"] }), false);
assert.equal(validateGeneratedQuestion({ ...valid, question_en: "x".repeat(1201) }), false);
assert.equal(validateGeneratedQuestion({ ...valid, subject: "Reasoning" + String.fromCharCode(0) }), false);
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


const largeContext = {
  active: Array.from({ length: 40 }, (_, i) => ({ id: i })),
  topicCounts: Object.fromEntries(Array.from({ length: 40 }, (_, i) => [`Topic ${i}`, i])),
  difficultyCounts: { easy: 10, medium: 20, hard: 10 },
  historicalEvidence: Array.from({ length: 30 }, (_, i) => ({
    subject: "Reasoning",
    topic: `Topic ${i}`,
    question_hi: "ह".repeat(600),
    question_en: "E".repeat(600),
    options: ["A".repeat(180), "B", "C", "D"],
    answer_index: 1,
    source_type: "pyq",
    source_name: "Official paper",
    source_url: "https://example.com/" + "x".repeat(300),
  })),
  sources: Array.from({ length: 30 }, (_, i) => ({
    board: "Board",
    name: `Source ${i}`,
    url: "https://example.com/" + "y".repeat(300),
  })),
};
const compactEvidence = buildWeeklyEvidence(largeContext);
assert.equal(compactEvidence.active_question_count, 40);
assert.equal(compactEvidence.actual_pyq_or_official_question_count, 30);
assert.equal(compactEvidence.topic_counts.length, 25);
assert.equal(compactEvidence.actual_past_question_sample.length, 12);
assert.equal(compactEvidence.official_source_references.length, 12);
assert.equal(compactEvidence.actual_past_question_sample[0].question_en.length, 260);
assert.equal(compactEvidence.actual_past_question_sample[0].options[0].length, 100);
assert.equal(compactEvidence.actual_past_question_sample[0].source_url.length, 220);


assert.equal(WEEKLY_REVIEW_BATCH_SIZE, 5);
const reviewQueue = Array.from({ length: 23 }, (_, i) => ({ question_en: "Question " + (i + 1) }));
const firstReview = takeWeeklyReviewBatch(reviewQueue);
assert.equal(firstReview.batch.length, 5);
assert.equal(firstReview.remainder.length, 18);
const secondReview = takeWeeklyReviewBatch(firstReview.remainder);
assert.equal(secondReview.batch.length, 5);
assert.equal(secondReview.remainder.length, 13);
const invalidBatchSize = takeWeeklyReviewBatch(reviewQueue, 0);
assert.equal(invalidBatchSize.batch.length, 5, "Invalid batch sizes should fall back to the safe default.");
let remainingQueue = reviewQueue;
const processedQueue = [];
while (remainingQueue.length) {
  const part = takeWeeklyReviewBatch(remainingQueue);
  processedQueue.push(...part.batch);
  remainingQueue = part.remainder;
}
assert.deepEqual(processedQueue, reviewQueue, "Chunked review must preserve every question exactly once.");
