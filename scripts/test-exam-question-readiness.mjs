import assert from "node:assert/strict";
import { summarizeExamQuestionBank } from "../lib/exam-question-readiness.mjs";

const questions = [
  { id: "1", question_en: "Who wrote the Arthashastra?", question_hi: "अर्थशास्त्र किसने लिखा?", source_type: "curated", explanation_hi: "Short", explanation_en: "Short" },
  { id: "2", question_en: " WHO WROTE THE ARTHASHASTRA? ", question_hi: "अर्थशास्त्र के लेखक कौन हैं?", source_type: "pyq", explanation_hi: "Detailed explanation", explanation_en: "Detailed explanation" },
  { id: "3", question_en: "Which river is the longest in India?", question_hi: "भारत की सबसे लंबी नदी कौन-सी है?", source_type: "official" },
  { id: "4", question_en: "Which river is the longest in India?", question_hi: "भारत में सबसे लंबी नदी कौन है?", source_type: "curated" },
  { id: "5", question_en: "What is the capital of Madhya Pradesh?", question_hi: "मध्य प्रदेश की राजधानी क्या है?", source_type: "curated" },
];

const ready = summarizeExamQuestionBank(questions, 3);
assert.equal(ready.rawQuestionCount, 5);
assert.equal(ready.verifiedQuestionCount, 3);
assert.equal(ready.questionBankReady, true);
assert.equal(ready.uniqueRows.length, 3);

const notReady = summarizeExamQuestionBank(questions, 4);
assert.equal(notReady.questionBankReady, false, "Duplicate raw rows must not make an exam READY.");

const empty = summarizeExamQuestionBank(null, 10);
assert.equal(empty.rawQuestionCount, 0);
assert.equal(empty.verifiedQuestionCount, 0);
assert.equal(empty.questionBankReady, false);

console.log("Exam readiness and deduplicated question-bank tests passed.");
