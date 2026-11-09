import assert from "node:assert/strict";
import {
  applyOptionOrder,
  createOptionOrder,
  getDisplayAnswerIndex,
  getOriginalAnswerIndex,
  isValidOptionOrder,
} from "../lib/mock-test-option-order.mjs";

const options = ["A", "B", "C", "D"];
const originalAnswer = 2;

for (let seed = 0; seed < 100; seed += 1) {
  let state = seed + 1;
  const random = () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
  const order = createOptionOrder(random);
  assert.equal(isValidOptionOrder(order), true);
  const displayed = applyOptionOrder(options, order);
  const displayAnswer = getDisplayAnswerIndex(order, originalAnswer);
  assert.equal(displayed[displayAnswer], options[originalAnswer]);
  assert.equal(getOriginalAnswerIndex(order, displayAnswer), originalAnswer);
}

assert.equal(isValidOptionOrder([0, 0, 1, 2]), false);
assert.equal(isValidOptionOrder([0, 1, 2]), false);
assert.throws(() => applyOptionOrder(options, [0, 0, 1, 2]), TypeError);
console.log("Mock-test option-order mapping tests passed.");
