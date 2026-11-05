const RECOVERABLE_PHASES = new Set(["generated", "needs_more"]);

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function isRecoverableWeeklyAnalysisTask(task) {
  if (!isObject(task) || task.task_type !== "weekly_exam_analysis" || task.status !== "failed") return false;
  if (!isObject(task.payload) || typeof task.payload.exam_id !== "string" || !task.payload.exam_id) return false;
  if (!isObject(task.result) || !RECOVERABLE_PHASES.has(task.result.phase)) return false;
  if (!isObject(task.result.analysis) || !Array.isArray(task.result.draft_questions)) return false;
  return task.result.draft_questions.length > 0;
}

/**
 * Pick the oldest eligible failed task with a saved analysis and question draft.
 * Failed tasks without a checkpoint are deliberately left terminal.
 */
export function selectRecoverableWeeklyAnalysisTask(
  tasks,
  { excludedExamIds = [], activeExamIds = [] } = {},
) {
  const excluded = new Set(excludedExamIds);
  const active = activeExamIds.length ? new Set(activeExamIds) : null;
  return (Array.isArray(tasks) ? tasks : [])
    .filter((task) => isRecoverableWeeklyAnalysisTask(task))
    .filter((task) => !excluded.has(task.payload.exam_id))
    .filter((task) => !active || active.has(task.payload.exam_id))
    .sort((a, b) => {
      const aDate = Date.parse(a.created_at || "");
      const bDate = Date.parse(b.created_at || "");
      const aTime = Number.isFinite(aDate) ? aDate : 0;
      const bTime = Number.isFinite(bDate) ? bDate : 0;
      return aTime - bTime || String(a.id || "").localeCompare(String(b.id || ""));
    })[0] || null;
}

/**
 * Re-queue a checkpoint without discarding its result. Low priority and a null
 * started_at let other queued work run before this provider-dependent retry.
 */
export function buildWeeklyAnalysisRecoveryUpdate(task) {
  const payload = isObject(task?.payload) ? task.payload : {};
  const priorityValue = Number(task?.priority);
  const priority = Number.isFinite(priorityValue) ? Math.min(0, Math.floor(priorityValue)) : 0;
  return {
    status: "queued",
    priority,
    started_at: null,
    completed_at: null,
    error_message: null,
    payload: { ...payload, provider_retry_count: 0 },
  };
}

export function shouldYieldAfterWorkerFailure(reason) {
  return reason === "free_quota" || reason === "transient_provider_error";
}
