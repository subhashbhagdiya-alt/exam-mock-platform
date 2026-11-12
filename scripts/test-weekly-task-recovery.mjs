import assert from "node:assert/strict";
import {
  WEEKLY_RECOVERY_CONFIRMATION,
  MAX_WEEKLY_RECOVERY_BATCH_SIZE,
  validateWeeklyRecoveryRequest,
  getWeeklyTaskRecoveryEligibility,
} from "../lib/weekly-task-recovery.mjs";

const ids = [
  "00000000-0000-4000-8000-000000000001",
  "00000000-0000-4000-8000-000000000002",
  "00000000-0000-4000-8000-000000000003",
  "00000000-0000-4000-8000-000000000004",
  "00000000-0000-4000-8000-000000000005",
  "00000000-0000-4000-8000-000000000006",
];

const goodRequest = {
  confirm: WEEKLY_RECOVERY_CONFIRMATION,
  task_ids: [ids[0]],
};

assert.deepEqual(validateWeeklyRecoveryRequest(goodRequest), {
  ok: true,
  taskIds: [ids[0]],
  dryRun: true,
});
assert.equal(validateWeeklyRecoveryRequest({ ...goodRequest, dry_run: false }).dryRun, false);
assert.equal(validateWeeklyRecoveryRequest({ ...goodRequest, confirm: "yes" }).ok, false);
assert.equal(validateWeeklyRecoveryRequest({ ...goodRequest, task_ids: [ids[0], ids[0]] }).ok, false);
assert.equal(validateWeeklyRecoveryRequest({ ...goodRequest, task_ids: [ids[0], ids[1]] }).ok, false,
  "Recovery must be one task per request to avoid partial updates during worker races.");
assert.equal(validateWeeklyRecoveryRequest({ ...goodRequest, task_ids: ["not-a-uuid"] }).ok, false);
assert.equal(validateWeeklyRecoveryRequest({ ...goodRequest, task_ids: ids.slice(0, MAX_WEEKLY_RECOVERY_BATCH_SIZE + 1) }).ok, false);
assert.equal(validateWeeklyRecoveryRequest({ ...goodRequest, dry_run: "false" }).ok, false);
assert.equal(validateWeeklyRecoveryRequest(null).ok, false);

const eligible = {
  id: ids[0],
  task_type: "weekly_exam_analysis",
  status: "failed",
  error_message: "Gemini API returned HTTP 503; no paid-provider fallback was attempted.",
  payload: { exam_id: "exam-1", provider_retry_count: 2 },
};
assert.deepEqual(getWeeklyTaskRecoveryEligibility(eligible), { ok: true, retryCount: 2 });

assert.equal(getWeeklyTaskRecoveryEligibility({ ...eligible, task_type: "question_bank_expansion" }).ok, false);
assert.equal(getWeeklyTaskRecoveryEligibility({ ...eligible, status: "queued" }).ok, false);
assert.equal(getWeeklyTaskRecoveryEligibility({ ...eligible, error_message: "Invalid JSON from Gemini" }).ok, false);
assert.equal(getWeeklyTaskRecoveryEligibility({ ...eligible, error_message: "Gemini API returned HTTP 429" }).ok, false);
assert.equal(getWeeklyTaskRecoveryEligibility({ ...eligible, payload: { exam_id: "" } }).ok, false);
assert.equal(getWeeklyTaskRecoveryEligibility({ ...eligible, payload: { exam_id: "exam-1", provider_retry_count: 4 } }).ok, false);
assert.equal(getWeeklyTaskRecoveryEligibility({ ...eligible, payload: { exam_id: "exam-1", provider_retry_count: "invalid" } }).ok, false);
assert.equal(getWeeklyTaskRecoveryEligibility(null).ok, false);

const resumable = {
  ...eligible,
  error_message: "Gemini request timed out after 3 bounded attempts; no paid-provider fallback was attempted.",
  payload: { exam_id: "exam-1", provider_retry_count: 0 },
};
assert.deepEqual(getWeeklyTaskRecoveryEligibility(resumable), { ok: true, retryCount: 0 });

console.log("Weekly analysis recovery validation checks passed.");
