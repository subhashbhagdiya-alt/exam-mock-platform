import assert from "node:assert/strict";
import { classifyWorkerFailure, resetWorkerRetryCount, MAX_TRANSIENT_PROVIDER_RETRIES } from "../lib/background-task-retry.mjs";

const initialPayload = { exam_id: "exam-123", target_new_questions: 50 };
const first = classifyWorkerFailure({ status: 503, message: "Service unavailable" }, initialPayload);
assert.deepEqual(first, {
  deferred: true, reason: "transient_provider_error", retryCount: 1,
  payload: { ...initialPayload, provider_retry_count: 1 }
});

const second = classifyWorkerFailure({ status: 504 }, first.payload);
assert.equal(second.deferred, true);
assert.equal(second.retryCount, 2);
assert.equal(second.payload.provider_retry_count, MAX_TRANSIENT_PROVIDER_RETRIES);

const capped = classifyWorkerFailure({ status: 503 }, second.payload);
assert.equal(capped.deferred, false, "Retries must stop at the configured cap.");
assert.equal(capped.reason, "terminal");
assert.equal(capped.payload.provider_retry_count, 2);

const quota = classifyWorkerFailure({ code: "FREE_QUOTA_EXHAUSTED", status: 429 }, initialPayload);
assert.equal(quota.deferred, true, "Free quota exhaustion remains queued for a future scheduled run.");
assert.equal(quota.reason, "free_quota");
assert.deepEqual(quota.payload, initialPayload);

const permanent = classifyWorkerFailure({ status: 400 }, initialPayload);
assert.equal(permanent.deferred, false, "Permanent errors should not be retried forever.");

const reset = resetWorkerRetryCount(second.payload);
assert.equal(reset.provider_retry_count, 0);
assert.equal(reset.exam_id, initialPayload.exam_id);
console.log("Background worker retry policy checks passed.");
