import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const page = read("app/page.jsx");
const layout = read("app/layout.jsx");
const compactCss = read("app/exam-compact.css");

const designImport = layout.indexOf('import "./design-system-v1.css";');
const compactImport = layout.indexOf('import "./exam-compact.css";');
assert.ok(designImport >= 0, "The global design system must be loaded.");
assert.ok(compactImport > designImport, "Compact CBT overrides must load after the global design system.");

const quickMetaStart = page.indexOf('<div className="quick-test-meta">');
assert.ok(quickMetaStart >= 0, "The CBT quick metadata row must exist.");
const quickMeta = page.slice(quickMetaStart, quickMetaStart + 700);
assert.ok(!quickMeta.includes("renderQuestionLanguageSwitch"), "The language selector should not take space in the compact metadata row.");
assert.ok(
  /className="exam-question-toolbar"\s*>\{renderQuestionLanguageSwitch\(\)\}/.test(page),
  "The question-language control must sit inside the question card toolbar."
);
assert.ok(page.includes('className="mobile-finish-test"'), "The fixed mobile finish action must remain in the CBT markup.");
assert.ok(page.includes('view !== "test"'), "The floating app navigation must not compete with the CBT finish action.");

const finishRules = compactCss.slice(compactCss.lastIndexOf("/* Keep the finish action reachable"));
assert.ok(finishRules.includes("display: inline-flex !important"), "The finish action must be visible in the compact mobile CBT.");
assert.ok(finishRules.includes("position: fixed !important"), "The finish action must stay in view while scrolling.");
assert.ok(finishRules.includes("env(safe-area-inset-bottom)"), "The finish action must respect mobile safe areas.");
assert.ok(finishRules.includes(".shell.exam-active .modal-backdrop { z-index: 1010 !important; }"), "The submit confirmation modal must appear above the fixed finish action.");

console.log("Compact CBT layout, language toolbar, and fixed finish-action tests passed.");
