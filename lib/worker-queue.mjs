export const MAX_TRANSIENT_PROVIDER_RETRIES = 3;
export const WORKER_RETRY_DELAY_MS = 24 * 60 * 60 * 1000;

const TRANSIENT_PROVIDER_STATUSES = new Set([500, 502, 503, 504]);

export function isTaskReadyForWorker(task, now = Date.now()) {
  const retryAfter = Date.parse(String(task?.payload?.retry_after || ""));
  return !Number.isFinite(retryAfter) || retryAfter <= now;
}

export function chooseReadyWorkerTask(tasks, now = Date.now()) {
  return (Array.isArray(tasks) ? tasks : []).find((task) => isTaskReadyForWorker(task, now)) || null;
}

export function classifyWorkerFailure(error, taskPayload = {}, now = Date.now()) {
  const payload = taskPayload && typeof taskPayload === "object" && !Array.isArray(taskPayload)
    ? taskPayload
    : {};
  const retryCountValue = Number(payload.provider_retry_count);
  const currentRetryCount = Number.isSafeInteger(retryCountValue) && retryCountValue > 0 ? retryCountValue : 0;
  const isQuota = error?.code === "FREE_QUOTA_EXHAUSTED" || Number(error?.status) === 429;
  const isTransient = TRANSIENT_PROVIDER_STATUSES.has(Number(error?.status)) ||
    error?.code === "GEMINI_TRANSIENT_FAILURE" ||
    /timed out|timeout/i.test(String(error?.message || ""));

  if (isQuota) {
    const retryAfter = new Date(now + WORKER_RETRY_DELAY_MS).toISOString();
    return {
      deferred: true,
      reason: "free_quota",
      retryCount: currentRetryCount,
      retryAfter,
      payload: { ...payload, retry_after: retryAfter }
    };
  }

  if (isTransient && currentRetryCount < MAX_TRANSIENT_PROVIDER_RETRIES) {
    const retryCount = currentRetryCount + 1;
    const retryAfter = new Date(now + WORKER_RETRY_DELAY_MS).toISOString();
    return {
      deferred: true,
      reason: "transient_provider_error",
      retryCount,
      retryAfter,
      payload: { ...payload, provider_retry_count: retryCount, retry_after: retryAfter }
    };
  }

  return {
    deferred: false,
    reason: "terminal",
    retryCount: currentRetryCount,
    retryAfter: null,
    payload
  };
}
