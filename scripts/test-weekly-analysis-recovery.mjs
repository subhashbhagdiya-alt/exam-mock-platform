import assert from "node:assert/strict";
import {
  buildWeeklyAnalysisRecoveryUpdate,
  isRecoverableWeeklyAnalysisTask,
  selectRecoverableWeeklyAnalysisTask,
  shouldYieldAfterWorkerFailure,
} from "../lib/weekly-analysis-recovery.mjs";

const makeTask = (overrides = {}) => ({
  id: "task-1",
  task_type: "weekly_exam_analysis",
  status: "failed",
  priority: 110,
  created_at: "2026-11-01T03:00:00.000Z",
  payload: { exam_id: "exam-a", exam_slug: "exam-a", provider_retry_count: 2 },
  result: {
    phase: "needs_more",
    analysis: { trend_summary: "Evidence summary" },
    draft_questions: [{ question_en: "Draft one" }],
  },
  ...overrides,
});

const oldest = makeTask({ id: "oldest", created_at: "2026-10-31T00:00:00.000Z" });
const newer = makeTask({ id: "newer", created_at: "2026-11-02T00:00:00.000Z", payload: { exam_id: "exam-b" } });
const invalid = makeTask({ id: "no-checkpoint", result: null });
const emptyDraft = makeTask({ id: "empty-draft", result: { phase: "generated", analysis: {}, draft_questions: [] } });
const generatedPhase = makeTask({ id: "generated-phase", result: { phase: "generated", analysis: {}, draft_questions: [{}] } });
const wrongPhase = makeTask({ id: "wrong-phase", result: { phase: "finished", analysis: {}, draft_questions: [{}] } });
const nonFailed = makeTask({ id: "queued", status: "queued" });

assert.equal(isRecoverableWeeklyAnalysisTask(oldest), true);
assert.equal(isRecoverableWeeklyAnalysisTask(invalid), false);
assert.equal(isRecoverableWeeklyAnalysisTask(emptyDraft), false);
assert.equal(isRecoverableWeeklyAnalysisTask(generatedPhase), false);
assert.equal(isRecoverableWeeklyAnalysisTask(wrongPhase), false);
assert.equal(isRecoverableWeeklyAnalysisTask(nonFailed), false);

assert.equal(
  selectRecoverableWeeklyAnalysisTask([newer, invalid, oldest], { activeExamIds: ["exam-a", "exam-b"] }).id,
  "oldest",
);
assert.equal(
  selectRecoverableWeeklyAnalysisTask([newer, oldest], { excludedExamIds: ["exam-a"] }).id,
  "newer",
);
assert.equal(
  selectRecoverableWeeklyAnalysisTask([newer, oldest], { activeExamIds: ["exam-a"] }).id,
  "oldest",
);
assert.equal(
  selectRecoverableWeeklyAnalysisTask([newer, oldest], { excludedExamIds: ["exam-a", "exam-b"] }),
  null,
);

const update = buildWeeklyAnalysisRecoveryUpdate(oldest);
assert.deepEqual(update, {
  status: "queued",
  priority: 0,
  started_at: null,
  completed_at: null,
  error_message: null,
  payload: { exam_id: "exam-a", exam_slug: "exam-a", provider_retry_count: 0 },
});
assert.equal(oldest.result.phase, "needs_more", "The original checkpoint is not mutated or discarded.");
assert.equal(shouldYieldAfterWorkerFailure("transient_provider_error"), true);
assert.equal(shouldYieldAfterWorkerFailure("free_quota"), true);
assert.equal(shouldYieldAfterWorkerFailure("terminal"), false);

console.log("Weekly analysis checkpoint recovery tests passed.");
