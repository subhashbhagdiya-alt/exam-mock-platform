import assert from "node:assert/strict";
import { isUuid } from "../lib/uuid.mjs";
import { isValidGradeSubmission } from "../lib/grade-submission-validation.mjs";
import { validateResultQuestionMapping } from "../lib/result-validation.mjs";
import { getLocalizedQuestionOptions, mergeQuestionIds } from "../lib/question-pool.mjs";
import { createRateLimiter, getClientIp } from "../lib/rate-limit.mjs";
import { createTtlCache } from "../lib/ttl-cache.mjs";

// --- UUID versions: v4 and time-ordered v7 must both be accepted everywhere ---
const v4 = "11111111-1111-4111-8111-111111111111";
const v7 = "018f3c5e-7b1a-7c3d-9a4b-1234567890ab";
assert.equal(isUuid(v4), true);
assert.equal(isUuid(v7), true);
assert.equal(isUuid("bad"), false);
assert.equal(isUuid(123), false);
assert.equal(isUuid(v4.replace("-4111-", "-0111-")), false, "version 0 is invalid");
assert.equal(isUuid(v4.replace("-4111-", "-9111-")), false, "version 9 is invalid");
assert.equal(isValidGradeSubmission({ test_session_id: v7, test_session_key: v7, answers: { 1: 0 } }), true);
assert.deepEqual(validateResultQuestionMapping({ 1: v7 }, 1), [v7]);
assert.deepEqual(mergeQuestionIds([v7]), [v7]);
console.log("UUID version tests passed.");

// --- Options: spaced slashes in values must not be treated as a language separator ---
const options = ["3 / 4", "1 / 2", "रबी / Rabi", "सत्य / असत्य"];
assert.deepEqual(getLocalizedQuestionOptions({ options }, "hi"), ["3 / 4", "1 / 2", "रबी", "सत्य / असत्य"]);
assert.deepEqual(getLocalizedQuestionOptions({ options }, "en"), ["3 / 4", "1 / 2", "Rabi", "सत्य / असत्य"]);
console.log("Option separator tests passed.");

// --- Rate limiter ---
let t = 0;
const check = createRateLimiter({ limit: 2, windowMs: 1000, now: () => t });
assert.equal(check("a").allowed, true);
assert.equal(check("a").allowed, true);
const blocked = check("a");
assert.equal(blocked.allowed, false);
assert.equal(blocked.retryAfterSeconds, 1);
assert.equal(check("b").allowed, true, "other keys are independent");
t = 1001;
assert.equal(check("a").allowed, true, "window slides forward");

const small = createRateLimiter({ limit: 1, windowMs: 1000, maxKeys: 2, now: () => t });
small("k1"); small("k2"); small("k3");
assert.equal(small("k1").allowed, true, "oldest key was evicted to bound memory");

assert.equal(getClientIp(new Headers({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" })), "1.2.3.4");
assert.equal(getClientIp(new Headers({ "x-real-ip": "9.9.9.9" })), "9.9.9.9");
assert.equal(getClientIp(new Headers()), "unknown");
console.log("Rate limiter tests passed.");

// --- TTL cache ---
let clock = 0;
const cache = createTtlCache({ ttlMs: 1000, maxEntries: 2, now: () => clock });
assert.equal(cache.get("a"), undefined, "empty cache misses");
cache.set("a", [1]);
assert.deepEqual(cache.get("a"), [1], "fresh entry is returned");
clock = 999;
assert.deepEqual(cache.get("a"), [1], "still fresh just before the ttl");
clock = 1000;
assert.equal(cache.get("a"), undefined, "expired at the ttl");
clock = 0;
cache.set("a", 1); cache.set("b", 2); cache.set("c", 3);
assert.equal(cache.get("a"), undefined, "oldest entry evicted beyond maxEntries");
assert.equal(cache.get("b"), 2);
assert.equal(cache.get("c"), 3);
cache.set("b", 20);
assert.equal(cache.get("b"), 20, "setting a key again replaces and refreshes it");
assert.deepEqual(createTtlCache({ ttlMs: 10 }).get("missing"), undefined);
console.log("TTL cache tests passed.");
