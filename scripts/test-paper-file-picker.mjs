import assert from "node:assert/strict";
import { openPaperFilePicker } from "../lib/paper-file-picker.mjs";

let showPickerCalls = 0;
let clickCalls = 0;
const modernInput = {
  showPicker() { showPickerCalls += 1; },
  click() { clickCalls += 1; },
};
assert.equal(openPaperFilePicker(modernInput), true);
assert.equal(showPickerCalls, 1);
assert.equal(clickCalls, 0, "Use the native showPicker API when it succeeds.");

let fallbackCalls = 0;
const fallbackInput = {
  showPicker() { throw new Error("showPicker is unavailable in this context"); },
  click() { fallbackCalls += 1; },
};
assert.equal(openPaperFilePicker(fallbackInput), true);
assert.equal(fallbackCalls, 1, "Fallback to input.click when showPicker throws.");

assert.equal(openPaperFilePicker({}), false, "Inputs without picker APIs should fail safely.");
assert.equal(openPaperFilePicker(null), false);

console.log("Native paper file-picker fallback tests passed.");
