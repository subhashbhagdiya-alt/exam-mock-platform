import assert from "node:assert/strict";
import { buildQuestionCatalog, filterQuestionRows, normalizeCategory } from "../lib/question-categories.mjs";

const rows = [
  { id: "1", subject: "  Mathematics ", topic: "Number   System" },
  { id: "2", subject: "mathematics", topic: "number system" },
  { id: "3", subject: "General Science", topic: "Chemistry" },
  { id: "4", subject: "Science", topic: "Chemistry" },
  { id: "5", subject: "हिंदी", topic: "व्याकरण" },
  { id: "6", subject: "", topic: "ignored" },
];

assert.equal(normalizeCategory("  General   Science "), "general science");
assert.deepEqual(filterQuestionRows(rows, "MATHEMATICS", "Number System").map(row => row.id), ["1", "2"]);
assert.deepEqual(filterQuestionRows(rows, "Science", "Chemistry").map(row => row.id), ["4"]);
assert.deepEqual(filterQuestionRows(rows, "", "Chemistry").map(row => row.id), ["3", "4"]);

const catalog = buildQuestionCatalog(rows);
assert(catalog.subjects.includes("Mathematics"));
assert(catalog.subjects.includes("General Science"));
assert(catalog.subjects.includes("Science"));
assert(catalog.subject_topics.some(item => item.subject === "Mathematics" && item.topic === "Number System"));
assert.equal(catalog.subject_topics.some(item => item.subject === "" || item.topic === ""), false);

console.log("Question category catalog/filter tests passed.");
