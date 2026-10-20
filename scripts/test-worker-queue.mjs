import assert from "node:assert/strict";
import {
  MAX_TRANSIENT_PROVIDER_RETRIES,
  WORKER_RETRY_DELAY_MS,
  chooseReadyWorkerTask,
  classifyWorkerFailure,
  isTaskReadyForWorker
} from "../lib/worker-queue.mjs";

const now = Date.parse("2026-10-20T12:00:00.000Z");
const readyTask = { id: "ready", payload: {} };
const coolingTask = {
  id: "cooling",
  payload: { retry_after: new Date(now + WORKER_RETRY_DELAY_MS).toISOString() }
};

assert.equal(isTaskReadyForWorker(readyTask, now), true);
assert.equal(isTaskReadyForWorker(coolingTask, now), false);
assert.equal(chooseReadyWorkerTask([coolingTask, readyTask], now), readyTask);
assert.equal(chooseReadyWorkerTask([coolingTask], now), null);
assert.equal(isTaskReadyForWorker(coolingTask, now + WORKER_RETRY_DELAY_MS), true);

const first = classifyWorkerFailure({ status: 503, message: "Service unavailable" }, { exam_id: "x" }, now);
assert.equal(first.deferred, true);
assert.equal(first.reason, "transient_provider_error");
assert.equal(first.retryCount, 1);
assert.equal(first.payload.provider_retry_count, 1);
assert.equal(Date.parse(first.retryAfter), now + WORKER_RETRY_DELAY_MS);

const second = classifyWorkerFailure({ message: "Gemini request timed out" }, first.payload, now);
assert.equal(second.deferred, true);
assert.equal(second.retryCount, 2);

const third = classifyWorkerFailure({ status: 504 }, second.payload, now);
assert.equal(third.deferred, true);
assert.equal(third.retryCount, MAX_TRANSIENT_PROVIDER_RETRIES);

const capped = classifyWorkerFailure({ status: 503 }, third.payload, now);
assert.equal(capped.deferred, false);
assert.equal(capped.reason, "terminal");

const quota = classifyWorkerFailure({ status: 429, code: "FREE_QUOTA_EXHAUSTED" }, { exam_id: "quota" }, now);
assert.equal(quota.deferred, true);
assert.equal(quota.reason, "free_quota");
assert.equal(quota.payload.exam_id, "quota");
assert.equal(Date.parse(quota.retryAfter), now + WORKER_RETRY_DELAY_MS);

const permanent = classifyWorkerFailure({ status: 400 }, { exam_id: "permanent" }, now);
assert.equal(permanent.deferred, false);

console.log("Cooldown-aware AI worker scheduling tests passed.");
