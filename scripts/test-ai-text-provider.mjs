import assert from "node:assert/strict";
import {
  DEFAULT_GEMINI_WORKER_MODEL,
  DEFAULT_GROQ_MODEL,
  buildGeminiGenerateContentBody,
  buildGroqChatCompletionBody,
  extractWorkerText,
  resolveWorkerTextProvider
} from "../lib/ai-text-provider.mjs";

assert.equal(DEFAULT_GROQ_MODEL, "openai/gpt-oss-120b");
assert.equal(resolveWorkerTextProvider({ GROQ_API_KEY: "groq-test", GEMINI_API_KEY: "gemini-test" }).provider, "groq");
assert.equal(resolveWorkerTextProvider({ GROQ_API_KEY: "groq-test" }).model, "openai/gpt-oss-120b");
assert.equal(
  resolveWorkerTextProvider({ GROQ_API_KEY: "groq-test", GROQ_MODEL: "custom/model" }).model,
  "custom/model"
);
assert.deepEqual(resolveWorkerTextProvider({ GEMINI_API_KEY: "gemini-test" }), {
  provider: "gemini",
  apiKey: "gemini-test",
  model: DEFAULT_GEMINI_WORKER_MODEL
});
assert.equal(resolveWorkerTextProvider({ GROQ_API_KEY: "  ", GEMINI_API_KEY: "" }), null);

const groqBody = buildGroqChatCompletionBody({
  model: DEFAULT_GROQ_MODEL,
  prompt: "Return JSON only.",
  maxOutputTokens: 1200
});
assert.equal(groqBody.model, "openai/gpt-oss-120b");
assert.deepEqual(groqBody.messages, [{ role: "user", content: "Return JSON only." }]);
assert.equal(groqBody.max_completion_tokens, 1200);
assert.equal("max_tokens" in groqBody, false);
assert.deepEqual(groqBody.response_format, { type: "json_object" });
assert.equal(groqBody.reasoning_format, "hidden");

const customGroqBody = buildGroqChatCompletionBody({
  model: "llama-3.3-70b-versatile",
  prompt: "Return JSON only.",
  maxOutputTokens: 500
});
assert.equal(customGroqBody.max_completion_tokens, 500);
assert.equal("reasoning_format" in customGroqBody, false);

assert.deepEqual(buildGeminiGenerateContentBody("hi", 600), {
  contents: [{ role: "user", parts: [{ text: "hi" }] }],
  generationConfig: { responseMimeType: "application/json", maxOutputTokens: 600 }
});
assert.equal(extractWorkerText("groq", { choices: [{ message: { content: '{"ok":true}' } }] }), '{"ok":true}');
assert.equal(extractWorkerText("gemini", { candidates: [{ content: { parts: [{ text: '{"ok":' }, { text: 'true}' }] } }] }), '{"ok":true}');

console.log("AI text provider configuration tests passed.");
