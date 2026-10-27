import assert from "node:assert/strict";
import { planManualTaskRecovery, MAX_MANUAL_RECOVERY_TASKS } from "../lib/manual-task-recovery.mjs";

assert.equal(MAX_MANUAL_RECOVERY_TASKS, 10);
const checkpointed = {
  id: "task-1",
  task_type: "weekly_exam_analysis",
  status: "failed",
  priority: 80,
  payload: { exam_id: "exam-1", target_new_questions: 50, provider_retry_count: 2 },
  result: { phase: "needs_more", draft_questions: [{ question_en: "Saved draft" }] },
  error_message: "Gemini timeout",
  completed_at: "2026-10-01T00:00:00Z"
};
const plan = planManualTaskRecovery(checkpointed);
assert.equal(plan.eligible, true);
assert.equal(plan.update.status, "queued");
assert.equal(plan.update.payload.provider_retry_count, 0);
assert.equal(plan.update.priority, 0, "manual recovery should yield to normal queue work");
assert.equal(plan.update.started_at, null);
assert.equal(plan.update.error_message, null);
assert.equal(plan.update.completed_at, null);
assert.equal(plan.summary.phase, "needs_more");
assert.equal(plan.summary.saved_draft_questions, 1);
assert.equal(checkpointed.result.draft_questions.length, 1, "the original checkpoint is not mutated");

assert.equal(planManualTaskRecovery({ ...checkpointed, status: "done" }).reason, "not_a_failed_weekly_analysis");
assert.equal(planManualTaskRecovery({ ...checkpointed, task_type: "question_bank_expansion" }).reason, "not_a_failed_weekly_analysis");
assert.equal(planManualTaskRecovery({ ...checkpointed, result: { phase: "started" } }).reason, "no_resumable_checkpoint");
assert.equal(planManualTaskRecovery({ ...checkpointed, payload: {} }).reason, "missing_exam_id");
console.log("Manual task recovery planner tests passed: only failed checkpointed weekly analyses are eligible; drafts are preserved.");
