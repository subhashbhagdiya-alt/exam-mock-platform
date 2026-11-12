import { MAX_TRANSIENT_PROVIDER_RETRIES } from "./background-task-retry.mjs";

export const WEEKLY_RECOVERY_CONFIRMATION = "REQUEUE_TRANSIENT_WEEKLY_ANALYSIS";
export const MAX_WEEKLY_RECOVERY_BATCH_SIZE = 1;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const TRANSIENT_GEMINI_FAILURES = [
  /^Gemini request timed out after \d+ bounded attempts\b/i,
  /^Gemini API returned HTTP (?:500|502|503|504)\b/i,
];

/**
 * Validate an explicit, bounded recovery request. Dry-run is the API default;
 * the caller must also supply the exact confirmation phrase before any write.
 */
export function validateWeeklyRecoveryRequest(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, reason: "Request body must be a JSON object." };
  }

  if (body.confirm !== WEEKLY_RECOVERY_CONFIRMATION) {
    return { ok: false, reason: "The explicit recovery confirmation phrase is missing." };
  }

  if (body.dry_run !== undefined && typeof body.dry_run !== "boolean") {
    return { ok: false, reason: "dry_run must be a boolean when supplied." };
  }

  if (!Array.isArray(body.task_ids) || body.task_ids.length < 1 || body.task_ids.length > MAX_WEEKLY_RECOVERY_BATCH_SIZE) {
    return {
      ok: false,
      reason: "Supply exactly one explicit task ID per request.",
    };
  }

  if (body.task_ids.some((id) => typeof id !== "string" || !UUID_PATTERN.test(id))) {
    return { ok: false, reason: "Every task ID must be a valid UUID." };
  }

  if (new Set(body.task_ids.map((id) => id.toLowerCase())).size !== body.task_ids.length) {
    return { ok: false, reason: "Duplicate task IDs are not allowed." };
  }

  return { ok: true, taskIds: body.task_ids, dryRun: body.dry_run !== false };
}

/**
 * Only requeue known transient Gemini failures with an exam payload and
 * retry budget remaining. Payload/result checkpoints are never cleared.
 */
export function getWeeklyTaskRecoveryEligibility(task) {
  if (!task || typeof task !== "object") return { ok: false, reason: "Task was not found." };
  if (task.task_type !== "weekly_exam_analysis") return { ok: false, reason: "Only weekly_exam_analysis tasks are eligible." };
  if (task.status !== "failed") return { ok: false, reason: "Task is not currently failed." };

  const payload = task.payload && typeof task.payload === "object" && !Array.isArray(task.payload)
    ? task.payload
    : null;
  if (!payload || typeof payload.exam_id !== "string" || !payload.exam_id.trim()) {
    return { ok: false, reason: "Task has no valid exam_id checkpoint." };
  }

  const failureMessage = typeof task.error_message === "string" ? task.error_message.trim() : "";
  if (!TRANSIENT_GEMINI_FAILURES.some((pattern) => pattern.test(failureMessage))) {
    return { ok: false, reason: "Failure is not a recognized transient Gemini timeout or 5xx response." };
  }

  const retryCount = payload.provider_retry_count == null ? 0 : Number(payload.provider_retry_count);
  if (!Number.isSafeInteger(retryCount) || retryCount < 0 || retryCount >= MAX_TRANSIENT_PROVIDER_RETRIES) {
    return { ok: false, reason: "The bounded provider retry budget is exhausted or invalid." };
  }

  return { ok: true, retryCount };
}
