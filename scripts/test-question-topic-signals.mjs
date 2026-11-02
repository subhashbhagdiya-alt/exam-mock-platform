import assert from "node:assert/strict";
import { buildQuestionTopicSignals } from "../lib/question-topic-signals.mjs";

const rows = [
  { subject: "Math", topic: "Ratio", source_type: "pyq", source_name: "RRB Group D 2022 Shift 1" },
  { subject: "Math", topic: "Ratio", source_type: "pyq", source_name: "RRB Group D 2022 Shift 1" },
  { subject: "Math", topic: "Ratio", source_type: "pyq", source_name: "RRB Group D 2022 Shift 2" },
  { subject: "Math", topic: "Ratio", source_type: "curated", source_name: "ExamPrep practice" },
  { subject: "Math", topic: "Percentages", source_type: "official", source_name: "MPESB Rulebook 2026" },
  { subject: "Math", topic: "Percentages", source_type: "official", source_name: "MPESB Rulebook 2026" },
  { subject: "Math", topic: "Percentages", source_type: "official", source_url: "https://example.test/rulebook" },
  { subject: "Reasoning", topic: "Series", source_type: "memory_based", source_name: "Candidate recall set A" },
  { subject: "Reasoning", topic: "Series", source_type: "memory_based", source_name: "Candidate recall set B" },
  { subject: "GK", topic: "Basic facts", source_type: "curated", source_name: "ExamPrep" },
  // A raw score must not influence source-backed ranking or leak to the returned UI data.
  { subject: "GK", topic: "Basic facts", source_type: "curated", source_name: "ExamPrep", prediction_score: 99999 },
];

const result = buildQuestionTopicSignals(rows);
assert.equal(result.length, 4);
assert.equal(result[0].subject, "Math");
assert.equal(result[0].topic, "Ratio");
assert.equal(result[0].question_count, 4);
assert.equal(result[0].pyq_question_count, 3);
assert.equal(result[0].pyq_paper_count, 2);
assert.equal(result[0].curated_question_count, 1);
assert.equal(result[0].signal_type, "pyq");

const percentages = result.find((item) => item.topic === "Percentages");
assert.equal(percentages.official_question_count, 3);
assert.equal(percentages.official_source_count, 2);
assert.equal(percentages.signal_type, "official");

const series = result.find((item) => item.topic === "Series");
assert.equal(series.memory_based_question_count, 2);
assert.equal(series.memory_based_source_count, 2);
assert.equal(series.signal_type, "memory_based");

const facts = result.find((item) => item.topic === "Basic facts");
assert.equal(facts.curated_question_count, 2);
assert.equal(facts.signal_type, "practice_only");
assert.equal(Object.hasOwn(facts, "prediction_score"), false);

assert.deepEqual(buildQuestionTopicSignals(rows, 2), result.slice(0, 2));
assert.deepEqual(buildQuestionTopicSignals([], 5), []);
assert.equal(buildQuestionTopicSignals(rows, 0).length, 0);
assert.equal(buildQuestionTopicSignals(rows, 100).length, 4);

console.log("Question topic source-signal tests passed.");
