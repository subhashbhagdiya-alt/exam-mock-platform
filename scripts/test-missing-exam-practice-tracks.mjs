import assert from "node:assert/strict";
import { addMissingExamPracticeTracks } from "../lib/add-missing-exam-practice-tracks.mjs";

const tracks = [
  { slug: "mpesb-common", exam_slug: "mpesb-common" },
  { slug: "ssc-cgl", exam_slug: "ssc-cgl" },
];
const exams = [
  { id: 1, slug: "mpesb-common", total_questions: 10 },
  { id: 2, slug: "mpesb-general", total_questions: 20 },
  { id: 3, slug: "ssc-general", total_questions: 30 },
];

const result = addMissingExamPracticeTracks(tracks, exams);
assert.equal(result.length, 4, "adds only active exams without matching track metadata");
assert.equal(result[0], tracks[0], "preserves existing track objects and ordering");
assert.equal(result[1], tracks[1], "preserves existing track objects and ordering");
assert.equal(result[2].exam_slug, "mpesb-general");
assert.equal(result[2].name_en, "MPESB General Practice");
assert.equal(result[2].required_question_count, 20);
assert.equal(result[2].official_url, null);
assert.equal(result[2].exam_date_text, null);
assert.equal(result[2].metadata_fallback, true);
assert.equal(result[2].question_bank_check_available, false);
assert.equal(result[3].exam_slug, "ssc-general");
assert.equal(result[3].name_en, "SSC General Practice");
assert.equal(result[3].required_question_count, 30);

const noMissing = addMissingExamPracticeTracks(result, exams);
assert.equal(noMissing.length, result.length, "does not add duplicates on repeated application");

console.log("Missing-exam fallback checks passed: preserves configured tracks, adds missing active exams without inventing official metadata, and avoids duplicates.");
