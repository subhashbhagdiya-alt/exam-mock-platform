export const MAX_TRANSIENT_PROVIDER_RETRIES = 2;

const TRANSIENT_PROVIDER_STATUSES = new Set([500, 502, 503, 504]);

function normalizePayload(payload) {
  return payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {};
}

function retryCount(payload) {
  const value = Number(normalizePayload(payload).provider_retry_count);
  return Number.isSafeInteger(value) && value > 0 ? value : 0;
}

/**
 * Queue transient free-provider failures for a bounded number of later worker runs.
 * Free-quota exhaustion stays queued, as before; no paid-provider fallback is used.
 */
export function classifyWorkerFailure(error, taskPayload = {}) {
  const payload = normalizePayload(taskPayload);
  const currentRetries = retryCount(payload);

  if (error?.code === "FREE_QUOTA_EXHAUSTED") {
    return { deferred: true, reason: "free_quota", retryCount: currentRetries, payload };
  }

  if (TRANSIENT_PROVIDER_STATUSES.has(Number(error?.status)) && currentRetries < MAX_TRANSIENT_PROVIDER_RETRIES) {
    const nextRetryCount = currentRetries + 1;
    return {
      deferred: true,
      reason: "transient_provider_error",
      retryCount: nextRetryCount,
      payload: { ...payload, provider_retry_count: nextRetryCount }
    };
  }

  return { deferred: false, reason: "terminal", retryCount: currentRetries, payload };
}

export function resetWorkerRetryCount(taskPayload = {}) {
  return { ...normalizePayload(taskPayload), provider_retry_count: 0 };
}
