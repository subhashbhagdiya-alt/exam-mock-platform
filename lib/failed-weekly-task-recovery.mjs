export const WEEKLY_ANALYSIS_TASK_TYPE = "weekly_exam_analysis";
export const RECOVERY_CONFIRMATION = "REQUEUE_ONE_FAILED_WEEKLY_TASK";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Accept exactly one task ID and a deliberate confirmation value.
 * Bulk recovery is intentionally unsupported to avoid draining free-tier quota.
 */
export function parseFailedWeeklyTaskRecoveryRequest(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "A JSON object is required." };
  }

  if (body.confirm !== RECOVERY_CONFIRMATION) {
    return { ok: false, error: "Explicit recovery confirmation is required." };
  }

  const taskId = typeof body.task_id === "string" ? body.task_id.trim() : "";
  if (!UUID_PATTERN.test(taskId)) {
    return { ok: false, error: "task_id must be a valid UUID." };
  }

  return { ok: true, taskId };
}

export function isRecoverableWeeklyAnalysisTask(task) {
  return Boolean(
    task &&
    task.task_type === WEEKLY_ANALYSIS_TASK_TYPE &&
    task.status === "failed"
  );
}

/**
 * Keep resumable task context intact while resetting only the bounded retry counter.
 * The database row's result/checkpoint is not part of this payload patch.
 */
export function buildFailedWeeklyTaskRecoveryPayload(payload) {
  const safePayload = payload && typeof payload === "object" && !Array.isArray(payload)
    ? payload
    : {};
  return { ...safePayload, provider_retry_count: 0 };
}
