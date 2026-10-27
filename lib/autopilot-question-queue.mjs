/**
 * Pure AutoPilot queue policy helpers.
 * These keep scheduling decisions deterministic and easy to test without a live database.
 */
export function selectExpansionCandidate(coverage, lastExpansionByExam, target = 500) {
  const lastRuns = lastExpansionByExam instanceof Map ? lastExpansionByExam : new Map();
  return (Array.isArray(coverage) ? coverage : [])
    .map((item) => ({
      ...item,
      activeVerified: Number(item.activeVerified) || 0,
      awaitingReview: Number(item.awaitingReview) || 0,
      total: (Number(item.activeVerified) || 0) + (Number(item.awaitingReview) || 0),
      lastExpansion: lastRuns.get(item.exam?.id) || ""
    }))
    .filter((item) => item.exam?.id && item.total < target)
    .sort((a, b) =>
      a.total - b.total ||
      (a.lastExpansion ? Date.parse(a.lastExpansion) : 0) - (b.lastExpansion ? Date.parse(b.lastExpansion) : 0) ||
      String(a.exam?.name || "").localeCompare(String(b.exam?.name || ""))
    )[0] || null;
}

export function isTaskTypeHandledRecently(taskType, activeTasks = [], recentlyCompletedTasks = []) {
  return [...(Array.isArray(activeTasks) ? activeTasks : []), ...(Array.isArray(recentlyCompletedTasks) ? recentlyCompletedTasks : [])]
    .some((task) => task?.task_type === taskType);
}
