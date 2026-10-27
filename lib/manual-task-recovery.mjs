import { resetWorkerRetryCount } from "./background-task-retry.mjs";

export const MAX_MANUAL_RECOVERY_TASKS = 10;
const RESUMABLE_PHASES = new Set(["generated", "needs_more"]);

/**
 * Prepare a manually selected failed weekly-analysis task for safe requeue.
 * Only checkpointed drafts are eligible; the saved result is intentionally preserved.
 */
export function planManualTaskRecovery(task) {
  if (!task || task.task_type !== "weekly_exam_analysis" || task.status !== "failed") {
    return { eligible: false, reason: "not_a_failed_weekly_analysis" };
  }
  const phase = task.result?.phase;
  if (!RESUMABLE_PHASES.has(phase)) {
    return { eligible: false, reason: "no_resumable_checkpoint" };
  }
  if (!task.payload?.exam_id) {
    return { eligible: false, reason: "missing_exam_id" };
  }

  return {
    eligible: true,
    update: {
      status: "queued",
      payload: resetWorkerRetryCount(task.payload),
      // Keep the saved draft/review checkpoint intact; do not prioritize recovery
      // above normal queue work and do not claim it has been processed.
      started_at: null,
      priority: Math.min(Number(task.priority ?? 0), 0),
      error_message: null,
      completed_at: null
    },
    summary: {
      id: task.id,
      exam_id: task.payload.exam_id,
      phase,
      saved_draft_questions: Array.isArray(task.result.draft_questions) ? task.result.draft_questions.length : 0
    }
  };
}
