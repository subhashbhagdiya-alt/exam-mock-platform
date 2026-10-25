export const DEFAULT_GROQ_MODEL = "openai/gpt-oss-120b";
export const DEFAULT_GEMINI_WORKER_MODEL = "gemini-3.6-flash";

export function resolveWorkerTextProvider(env = process.env) {
  if (typeof env.GROQ_API_KEY === "string" && env.GROQ_API_KEY.trim()) {
    return {
      provider: "groq",
      apiKey: env.GROQ_API_KEY,
      model: env.GROQ_MODEL || DEFAULT_GROQ_MODEL
    };
  }
  if (typeof env.GEMINI_API_KEY === "string" && env.GEMINI_API_KEY.trim()) {
    return {
      provider: "gemini",
      apiKey: env.GEMINI_API_KEY,
      model: env.GEMINI_WORKER_MODEL || DEFAULT_GEMINI_WORKER_MODEL
    };
  }
  return null;
}

export function buildGroqChatCompletionBody({ model, prompt, maxOutputTokens = 16000 }) {
  return {
    model,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.2,
    max_completion_tokens: maxOutputTokens,
    response_format: { type: "json_object" },
    ...(model.startsWith("openai/gpt-oss-") ? { reasoning_format: "hidden" } : {})
  };
}

export function buildGeminiGenerateContentBody(prompt, maxOutputTokens = 16000) {
  return {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: "application/json", maxOutputTokens }
  };
}

export function extractWorkerText(provider, body) {
  if (provider === "groq") return body.choices?.[0]?.message?.content || "";
  return (body.candidates?.[0]?.content?.parts || []).map(part => part.text || "").join("");
}
