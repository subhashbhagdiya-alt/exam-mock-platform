import assert from "node:assert/strict";
import {
  buildUnlinkedExamTrack,
  getUnlinkedActiveExams,
  inferExamBoard
} from "../lib/job-track-fallbacks.mjs";

const mpesb = {
  id: "mpesb-id",
  slug: "mpesb-general",
  name: "MPESB General Practice",
  description: "Madhya Pradesh ESB exam practice and predicted questions",
  total_questions: 20
};
const ssc = {
  id: "ssc-id",
  slug: "ssc-general",
  name: "SSC General Practice",
  description: "SSC-style general competitive exam practice and predicted questions",
  total_questions: 30
};
const linked = { slug: "mpesb-common", exam_slug: "mpesb" };

assert.equal(inferExamBoard(mpesb), "MPESB");
assert.equal(inferExamBoard(ssc), "SSC");
assert.equal(inferExamBoard({ slug: "unclassified-exam", name: "Other Exam" }), "OTHER");
assert.deepEqual(getUnlinkedActiveExams([mpesb, ssc], [linked]), [mpesb, ssc]);
assert.deepEqual(getUnlinkedActiveExams([mpesb, ssc], [
  { exam_slug: "mpesb-general" },
  { exam_slug: "ssc-general" }
]), []);

const stats = {
  verifiedCounts: new Map([["mpesb-id", 58], ["ssc-id", 27]]),
  sourceCounts: new Map([
    ["mpesb-id:curated", 58],
    ["mpesb-id:pyq", 0],
    ["mpesb-id:official", 0],
    ["ssc-id:curated", 27]
  ]),
  subjectSets: new Map([["mpesb-id", new Set(["Maths", "Reasoning"])]]),
  topicSets: new Map([["mpesb-id", new Set(["Percentage", "Series"])]]),
  topicSignalRows: new Map([["mpesb-id", []], ["ssc-id", []]])
};

const readyTrack = buildUnlinkedExamTrack(mpesb, 0, stats);
assert.equal(readyTrack.exam_board, "MPESB");
assert.equal(readyTrack.name_hi, "एमपीईएसबी सामान्य अभ्यास");
assert.equal(readyTrack.question_bank_ready, true);
assert.equal(readyTrack.verified_question_count, 58);
assert.equal(readyTrack.practice_question_count, 58);
assert.equal(readyTrack.pyq_question_count, 0);
assert.equal(readyTrack.official_question_count, 0);
assert.deepEqual(readyTrack.subjects, ["Maths", "Reasoning"]);
assert.equal(readyTrack.is_general_practice, true);
assert.equal(readyTrack.official_url, null);

const notReadyTrack = buildUnlinkedExamTrack(ssc, 1, stats);
assert.equal(notReadyTrack.exam_board, "SSC");
assert.equal(notReadyTrack.question_bank_ready, false);
assert.equal(notReadyTrack.status, "practice");
assert.equal(notReadyTrack.verified_question_count, 27);
assert.equal(notReadyTrack.required_question_count, 30);

console.log("General-practice fallback catalog tests passed.");
