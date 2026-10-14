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


// Guard known high-risk bilingual choices against accidental A/B/C/D reordering.
// These cases are also covered by live manual browser regression checks.
const knownQuestionOptions = [
  {
    id: "4b96228e-a951-4006-83fc-d5fd7897ead0",
    en: ["Industry", "Agricultural production", "Transport", "Mining"],
    hi: ["उद्योग", "कृषि उत्पादन", "परिवहन", "खनन"]
  },
  {
    id: "290db196-3a40-4d8a-8691-6c3e7f154bfc",
    en: ["Major Dhyan Chand", "Milkha Singh", "Kapil Dev", "Sachin Tendulkar"],
    hi: ["मेजर ध्यानचंद", "मिल्खा सिंह", "कपिल देव", "सचिन तेंदुलकर"]
  },
  {
    id: "9ee92455-c740-41cb-a999-0a4cee5d5374",
    en: [
      "Lok Sabha and Legislative Assembly",
      "Lok Sabha and Rajya Sabha",
      "Rajya Sabha and Legislative Council",
      "Legislative Assembly and Legislative Council"
    ],
    hi: [
      "लोकसभा और विधानसभा",
      "लोकसभा और राज्यसभा",
      "राज्यसभा और विधान परिषद",
      "विधानसभा और विधान परिषद"
    ]
  },
  {
    id: "054cfd5c-0eb4-4830-b913-f6dc1c767da3",
    en: ["Madhya Pradesh", "Rajasthan", "Gujarat", "Maharashtra"],
    hi: ["मध्य प्रदेश", "राजस्थान", "गुजरात", "महाराष्ट्र"]
  }
];

for (const question of knownQuestionOptions) {
  const entry = localizationEntries.get(question.id);
  assert.ok(entry, `Missing high-risk question localization: ${question.id}`);
  assert.deepEqual(entry.optionsEn, question.en, `English A/B/C/D order changed: ${question.id}`);
  assert.deepEqual(hindiOptions[question.id] || entry.optionsHi, question.hi, `Hindi A/B/C/D order changed: ${question.id}`);
}

const knownHindiOverrides = [
  {
    id: "45648cdd-6d6b-42f0-93e5-c3ec89f43a72",
    hi: ["पेंच", "कान्हा", "सतपुड़ा", "बांधवगढ़"]
  },
  {
    id: "00276434-e4a5-4bfd-95d4-fbca1d811567",
    hi: ["अनुच्छेद 12–35", "अनुच्छेद 36–51", "अनुच्छेद 52–78", "अनुच्छेद 79–122"]
  }
];
for (const question of knownHindiOverrides) {
  const entry = localizationEntries.get(question.id);
  assert.ok(entry, `Missing Hindi override localization: ${question.id}`);
  assert.deepEqual(hindiOptions[question.id] || entry.optionsHi, question.hi, `Hindi A/B/C/D order changed: ${question.id}`);
}

console.log(`Localization regression checks passed: ${Object.keys(hindiOptions).length} Hindi option sets, ${localizationEntries.size} localized questions, and age, Green Revolution, National Sports Day, Parliament, Kanha, and Fundamental Rights option order.`);
