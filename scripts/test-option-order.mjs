import assert from "node:assert/strict";
import {
  mapDisplayedAnswersToOriginal,
  mapOriginalReviewToDisplayed,
  reorderOptions,
  shuffleOptionOrder,
} from "../lib/option-order.mjs";

const originalOptions = ["Alpha", "Bravo", "Charlie", "Delta"];
const order = [2, 0, 3, 1];
assert.deepEqual(reorderOptions(originalOptions, order), ["Charlie", "Alpha", "Delta", "Bravo"]);

const displayedAnswers = { "1": 0, "2": 3, "3": "" };
const orders = { "1": order, "2": [3, 2, 1, 0], "3": [0, 1, 2, 3] };
assert.deepEqual(mapDisplayedAnswersToOriginal(displayedAnswers, orders), { "1": 2, "2": 0 });

const originalReview = [
  { id: 1, answer: 2, explanation_en: "The original correct answer." },
  { id: 2, answer: 0 },
  { id: 3, answer: null },
];
const displayedReview = mapOriginalReviewToDisplayed(originalReview, orders);
assert.equal(displayedReview[0].answer, 0);
assert.equal(displayedReview[1].answer, 3);
assert.equal(displayedReview[2].answer, null);
assert.equal(displayedReview[0].explanation_en, originalReview[0].explanation_en);

// A deterministic random source still produces a valid permutation.
const shuffled = shuffleOptionOrder(4, () => 0);
assert.equal(shuffled.length, 4);
assert.deepEqual([...shuffled].sort(), [0, 1, 2, 3]);
assert.throws(() => reorderOptions(originalOptions, [0, 0, 2, 3]), /permutation/);
assert.throws(() => mapDisplayedAnswersToOriginal({ "1": 4 }, { "1": order }), /mapping/);
assert.throws(() => shuffleOptionOrder(1), /Option count/);

console.log("Practice option-order mapping tests passed.");
