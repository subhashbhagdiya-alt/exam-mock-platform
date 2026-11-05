import assert from "node:assert/strict";
import {
  applyOptionOrder,
  createOptionOrder,
  mapDisplayedAnswersToOriginal,
  toDisplayAnswer,
  toOriginalAnswer,
} from "../lib/option-order.mjs";

const originalOptions = ["Alpha", "Bravo", "Charlie", "Delta"];
const order = createOptionOrder(4, () => 0);
assert.deepEqual(order, [1, 2, 3, 0]);
assert.deepEqual(applyOptionOrder(originalOptions, order), ["Bravo", "Charlie", "Delta", "Alpha"]);

for (let displayedIndex = 0; displayedIndex < 4; displayedIndex += 1) {
  const originalIndex = toOriginalAnswer(displayedIndex, order);
  assert.equal(toDisplayAnswer(originalIndex, order), displayedIndex);
}

assert.deepEqual(
  mapDisplayedAnswersToOriginal(
    { 1: 0, 2: 2, 3: undefined },
    [
      { id: 1, optionOrder: order },
      { id: 2, optionOrder: [3, 2, 0, 1] },
      { id: 3, optionOrder: [0, 1, 2, 3] },
    ],
  ),
  { 1: 1, 2: 0 },
);

assert.deepEqual(createOptionOrder(4, () => 1), [0, 1, 2, 3]);
assert.throws(() => createOptionOrder(0), RangeError);
assert.throws(() => applyOptionOrder(originalOptions, [0, 0, 1, 2]), RangeError);
assert.throws(
  () => mapDisplayedAnswersToOriginal({ 1: 7 }, [{ id: 1, optionOrder: order }]),
  RangeError,
);
assert.equal(toOriginalAnswer(undefined, order), null);
assert.equal(toDisplayAnswer(9, order), null);

console.log("Randomized option order and grading-index mapping tests passed.");
