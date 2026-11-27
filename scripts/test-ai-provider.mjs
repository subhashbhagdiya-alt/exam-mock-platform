import assert from "node:assert/strict";
import { callAiJson, getAiConfig, GEMINI_DEFAULT_MODEL, missingAiKeyMessage } from "../lib/ai-provider.mjs";

// --- provider selection: free Gemini first ---
assert.equal(getAiConfig({}), null, "no keys -> no provider");
assert.deepEqual(getAiConfig({ GEMINI_API_KEY: " g1 " }), { provider: "gemini", apiKey: "g1", model: GEMINI_DEFAULT_MODEL });
assert.equal(getAiConfig({ GEMINI_API_KEY: "g1", GEMINI_API_KEY_2: "g2" }).apiKey, "g2", "the secondary key wins");
assert.equal(getAiConfig({ GEMINI_API_KEY: "g1", OPENAI_API_KEY: "o1" }).provider, "gemini", "Gemini is preferred when both exist");
assert.equal(getAiConfig({ OPENAI_API_KEY: "o1" }).provider, "openai", "OpenAI is used when it is the only key");
assert.equal(getAiConfig({ GEMINI_API_KEY: "g1", OPENAI_API_KEY: "o1", AI_PROVIDER: "openai" }).provider, "openai");
assert.equal(getAiConfig({ OPENAI_API_KEY: "o1", AI_PROVIDER: "gemini" }), null, "forced provider without its key -> none");
assert.equal(getAiConfig({ GEMINI_API_KEY: "g1", GEMINI_MODEL: "my-model" }).model, "my-model");
assert.match(missingAiKeyMessage(), /GEMINI_API_KEY/);
console.log("AI provider selection tests passed.");

// --- helpers for a fake fetch ---
const gemini = { provider: "gemini", apiKey: "k", model: "m1" };
const geminiBody = (text, finishReason = "STOP") => ({ candidates: [{ finishReason, content: { parts: [{ text }] } }] });
const okResponse = (body) => ({ ok: true, status: 200, json: async () => body });
const errResponse = (status, message = "x") => ({ ok: false, status, json: async () => ({ error: { message } }) });
const fakeFetch = (...steps) => {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url, init });
    const step = steps[Math.min(calls.length - 1, steps.length - 1)];
    if (step instanceof Error) throw step;
    return step;
  };
  impl.calls = calls;
  return impl;
};
const timeoutError = () => Object.assign(new Error("timeout"), { name: "TimeoutError" });
const opts = (fetchImpl) => ({ fetchImpl, sleep: async () => {}, deadlineAt: Date.now() + 50_000 });

// --- Gemini success, including a fenced JSON answer ---
let f = fakeFetch(okResponse(geminiBody("```json\n{\"questions\":[1,2]}\n```")));
assert.deepEqual(await callAiJson(gemini, "hello", 1234, opts(f)), { questions: [1, 2] });
assert.equal(f.calls.length, 1);
assert.match(f.calls[0].url, /generativelanguage\.googleapis\.com\/v1beta\/models\/m1:generateContent$/);
assert.equal(f.calls[0].init.headers["x-goog-api-key"], "k");
const sent = JSON.parse(f.calls[0].init.body);
assert.equal(sent.generationConfig.responseMimeType, "application/json");
assert.equal(sent.generationConfig.maxOutputTokens, 1234);
assert.equal(sent.contents[0].parts[0].text, "hello");

// --- 429 = free quota exhausted: no retry, classified by the existing retry logic ---
f = fakeFetch(errResponse(429, "quota"));
await assert.rejects(callAiJson(gemini, "p", 100, opts(f)), (e) => e.code === "FREE_QUOTA_EXHAUSTED" && e.status === 429);
assert.equal(f.calls.length, 1, "quota errors are not retried inside one run");

// --- transient 503 is retried once ---
f = fakeFetch(errResponse(503), okResponse(geminiBody("{\"ok\":true}")));
assert.deepEqual(await callAiJson(gemini, "p", 100, opts(f)), { ok: true });
assert.equal(f.calls.length, 2);

// --- timeouts: two attempts, then a transient 504 the worker can retry on a later run ---
f = fakeFetch(timeoutError(), timeoutError());
await assert.rejects(callAiJson(gemini, "p", 100, opts(f)), (e) => e.status === 504 && e.code === "GEMINI_TRANSIENT_FAILURE" && /2 bounded attempts/.test(e.message));
assert.equal(f.calls.length, 2);

// --- no time left in the 60 s budget: fail fast without calling the provider ---
f = fakeFetch(okResponse(geminiBody("{}")));
await assert.rejects(callAiJson(gemini, "p", 100, { fetchImpl: f, sleep: async () => {}, deadlineAt: Date.now() + 3000 }), (e) => e.status === 504);
assert.equal(f.calls.length, 0);

// --- the attempt timeout uses the remaining budget, capped at 40 s ---
let seenSignals = 0;
const signalFetch = async (url, init) => { seenSignals += init.signal ? 1 : 0; return okResponse(geminiBody("{}")); };
await callAiJson(gemini, "p", 100, { fetchImpl: signalFetch, deadlineAt: Date.now() + 30_000 });
assert.equal(seenSignals, 1, "every attempt carries a timeout signal");

// --- cut-off or invalid output is rejected, nothing is staged ---
f = fakeFetch(okResponse(geminiBody("{\"questions\":[", "MAX_TOKENS")));
await assert.rejects(callAiJson(gemini, "p", 100, opts(f)), /cut off/);
f = fakeFetch(okResponse(geminiBody("not json")));
await assert.rejects(callAiJson(gemini, "p", 100, opts(f)), /not valid JSON/);
f = fakeFetch(okResponse({ promptFeedback: { blockReason: "SAFETY" } }));
await assert.rejects(callAiJson(gemini, "p", 100, opts(f)), /blocked the prompt/);

// --- the existing OpenAI path still works when it is selected ---
const openai = { provider: "openai", apiKey: "o", model: "om" };
f = fakeFetch(okResponse({ output_text: "{\"a\":1}" }));
assert.deepEqual(await callAiJson(openai, "p", 100, opts(f)), { a: 1 });
assert.equal(f.calls[0].init.headers.authorization, "Bearer o");
f = fakeFetch(errResponse(429, "You have no credits remaining."));
await assert.rejects(callAiJson(openai, "p", 100, opts(f)), (e) => e.code === "FREE_QUOTA_EXHAUSTED" && /no credits/.test(e.message));
f = fakeFetch(okResponse({ status: "incomplete" }));
await assert.rejects(callAiJson(openai, "p", 100, opts(f)), /incomplete/);

console.log("AI provider call tests passed.");
