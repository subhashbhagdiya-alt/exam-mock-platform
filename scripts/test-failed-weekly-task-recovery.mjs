import assert from "node:assert/strict";
import {
  buildFailedWeeklyTaskRecoveryPayload,
  isRecoverableWeeklyAnalysisTask,
  parseFailedWeeklyTaskRecoveryRequest,
  RECOVERY_CONFIRMATION,
  WEEKLY_ANALYSIS_TASK_TYPE,
} from "../lib/failed-weekly-task-recovery.mjs";

const taskId = "dd71bce0-8ff0-41d3-8268-a095142133b9";

assert.deepEqual(parseFailedWeeklyTaskRecoveryRequest(null), {
  ok: false,
  error: "A JSON object is required.",
});
assert.equal(
  parseFailedWeeklyTaskRecoveryRequest({ task_id: taskId }).ok,
  false,
  "Recovery must require an explicit confirmation value.",
);
assert.equal(
  parseFailedWeeklyTaskRecoveryRequest({
    task_id: "not-a-uuid",
    confirm: RECOVERY_CONFIRMATION,
  }).ok,
  false,
);
assert.deepEqual(
  parseFailedWeeklyTaskRecoveryRequest({
    task_id: taskId,
    confirm: RECOVERY_CONFIRMATION,
  }),
  { ok: true, taskId },
);

assert.equal(
  isRecoverableWeeklyAnalysisTask({ task_type: WEEKLY_ANALYSIS_TASK_TYPE, status: "failed" }),
  true,
);
assert.equal(
  isRecoverableWeeklyAnalysisTask({ task_type: WEEKLY_ANALYSIS_TASK_TYPE, status: "queued" }),
  false,
  "Already queued tasks must not be recovered again.",
);
assert.equal(
  isRecoverableWeeklyAnalysisTask({ task_type: "source_health", status: "failed" }),
  false,
  "Other task types must never be requeued by this endpoint.",
);
assert.equal(isRecoverableWeeklyAnalysisTask(null), false);

const originalPayload = {
  exam_id: "exam-123",
  exam_slug: "sample-exam",
  provider_retry_count: 4,
  selection_reason: "oldest analysis first",
};
const recoveredPayload = buildFailedWeeklyTaskRecoveryPayload(originalPayload);
assert.deepEqual(recoveredPayload, {
  ...originalPayload,
  provider_retry_count: 0,
});
assert.equal(originalPayload.provider_retry_count, 4, "The original payload must not be mutated.");
assert.deepEqual(
  buildFailedWeeklyTaskRecoveryPayload(null),
  { provider_retry_count: 0 },
);
assert.deepEqual(
  buildFailedWeeklyTaskRecoveryPayload(["invalid"]),
  { provider_retry_count: 0 },
);

console.log("Failed weekly task recovery safety tests passed.");
