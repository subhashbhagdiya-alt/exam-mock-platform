import fs from "node:fs";
import assert from "node:assert/strict";

const pagePath = new URL("../app/page.jsx", import.meta.url);
const source = fs.readFileSync(pagePath, "utf8");

function extractObject(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, `Missing marker: ${startMarker}`);
  const end = source.indexOf(endMarker, start);
  assert.notEqual(end, -1, `Missing end marker for: ${startMarker}`);
  const text = source.slice(start + startMarker.length, end).trim();
  return JSON.parse(text);
}

const hindiOptions = extractObject(
  "const QUESTION_OPTIONS_HI = ",
  ";\n\nfunction getQuestionSourceLabel"
);
const localizationStart = source.indexOf("const QUESTION_LOCALIZATIONS = {");
assert.notEqual(localizationStart, -1, "Missing QUESTION_LOCALIZATIONS");
const localizationEnd = source.indexOf("\n};", localizationStart);
assert.notEqual(localizationEnd, -1, "Malformed QUESTION_LOCALIZATIONS");
const localizationText = source.slice(localizationStart, localizationEnd + 3);

const localizationEntries = new Map();
const entryPattern = /"([0-9a-f-]{36})":\s*\{([^}]*)\}/g;
for (const match of localizationText.matchAll(entryPattern)) {
  const [, id, body] = match;
  const entry = {};
  for (const key of ["optionsHi", "optionsEn"]) {
    const arrayMatch = body.match(new RegExp(`${key}:\\s*(\\[[^\\]]*\\])`));
    if (arrayMatch) {
      try {
        entry[key] = JSON.parse(arrayMatch[1]);
      } catch {
        assert.fail(`Invalid JSON option array for ${id} / ${key}`);
      }
    }
  }
  localizationEntries.set(id, entry);
}

assert.ok(Object.keys(hindiOptions).length > 0, "Hindi option dictionary must not be empty");
for (const [id, options] of Object.entries(hindiOptions)) {
  assert.ok(localizationEntries.has(id), `Hindi option set has no question localization entry: ${id}`);
  assert.equal(options.length, 4, `Hindi options must have exactly four choices: ${id}`);
  assert.ok(options.every(option => typeof option === "string" && option.trim()), `Hindi options must be non-empty strings: ${id}`);
}

for (const [id, entry] of localizationEntries) {
  for (const key of ["optionsHi", "optionsEn"]) {
    if (entry[key]) {
      assert.equal(entry[key].length, 4, `${key} must have exactly four choices: ${id}`);
      assert.ok(entry[key].every(option => typeof option === "string" && option.trim()), `${key} must contain non-empty strings: ${id}`);
    }
  }
}

const ageId = "248f4ea3-a93a-421f-ab19-432da695461f";
const ageMatch = localizationText.match(new RegExp(`"${ageId}":\\s*\\{([^}]*)\\}`));
assert.ok(ageMatch, "Age-question localization must exist");
const ageBody = ageMatch[1];
for (const key of ["optionsHi", "optionsEn"]) {
  const match = ageBody.match(new RegExp(`${key}:\\s*(\\[[^\\]]*\\])`));
  assert.ok(match, `Age question must define ${key}`);
  assert.deepEqual(JSON.parse(match[1]), ["15", "20", "25", "30"], `Age question ${key} order must remain A=15, B=20, C=25, D=30`);
}
assert.match(ageBody, /hi:\s*"/, "Age question needs Hindi text");
assert.match(ageBody, /en:\s*"/, "Age question needs English text");

console.log(`Localization regression checks passed: ${Object.keys(hindiOptions).length} Hindi option sets, ${localizationEntries.size} localized questions, and age-question A/B/C/D order.`);
