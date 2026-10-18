import assert from "node:assert/strict";
import { scorePaperQuiz } from "../lib/paper-analysis-quiz.mjs";

const questions = [
  { answer_index: 1 },
  { answer_index: 2 },
  { answer_index: 0 },
  { answer_index: 3 }
];

assert.deepEqual(scorePaperQuiz(questions, { 0: 1, 1: 2, 2: 1 }), {
  total: 4,
  answered: 3,
  correct: 2,
  incorrect: 1,
  unanswered: 1,
  percentage: 50
});

assert.deepEqual(scorePaperQuiz(questions, { 0: 1, 1: 2, 2: 0, 3: 3 }), {
  total: 4,
  answered: 4,
  correct: 4,
  incorrect: 0,
  unanswered: 0,
  percentage: 100
});

assert.deepEqual(scorePaperQuiz(questions, {}), {
  total: 4,
  answered: 0,
  correct: 0,
  incorrect: 0,
  unanswered: 4,
  percentage: 0
});

assert.deepEqual(scorePaperQuiz([], {}), {
  total: 0,
  answered: 0,
  correct: 0,
  incorrect: 0,
  unanswered: 0,
  percentage: 0
});

assert.deepEqual(scorePaperQuiz(questions, { 0: 5, 1: "2", 2: -1, 3: 3 }), {
  total: 4,
  answered: 1,
  correct: 1,
  incorrect: 0,
  unanswered: 3,
  percentage: 25
});

assert.deepEqual(scorePaperQuiz(null, null), {
  total: 0,
  answered: 0,
  correct: 0,
  incorrect: 0,
  unanswered: 0,
  percentage: 0
});

console.log("Paper-analysis quiz scoring tests passed.");
