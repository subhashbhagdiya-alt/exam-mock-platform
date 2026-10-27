import assert from "node:assert/strict";
import { isTaskTypeHandledRecently, selectExpansionCandidate } from "../lib/autopilot-question-queue.mjs";

const exams = [
  { exam: { id: "ssc", name: "SSC" }, activeVerified: 300, awaitingReview: 10 },
  { exam: { id: "rrb", name: "RRB" }, activeVerified: 120, awaitingReview: 20 },
  { exam: { id: "mpesb", name: "MPESB" }, activeVerified: 140, awaitingReview: 0 }
];

const leastCovered = selectExpansionCandidate(exams, new Map([["rrb", "2026-10-20T00:00:00.000Z"]]));
assert.equal(leastCovered.exam.id, "rrb", "Select the exam with the smallest verified plus staged bank.");
assert.equal(leastCovered.total, 140);

const tie = selectExpansionCandidate([
  { exam: { id: "recent", name: "A" }, activeVerified: 100, awaitingReview: 10 },
  { exam: { id: "missing", name: "Z" }, activeVerified: 100, awaitingReview: 10 }
], new Map([["recent", "2026-10-25T00:00:00.000Z"]]));
assert.equal(tie.exam.id, "missing", "On coverage ties, favor the exam expanded least recently.");

assert.equal(selectExpansionCandidate([
  { exam: { id: "complete", name: "Complete" }, activeVerified: 500, awaitingReview: 0 }
], new Map()), null, "Do not queue expansion after an exam reaches target.");

assert.equal(isTaskTypeHandledRecently("question_bank_expansion", [{ task_type: "question_bank_expansion" }], []), true);
assert.equal(isTaskTypeHandledRecently("question_bank_expansion", [], [{ task_type: "question_bank_expansion", status: "done" }]), true);
assert.equal(isTaskTypeHandledRecently("source_review", [], []), false);

console.log("AutoPilot queue selection and deduplication checks passed.");
