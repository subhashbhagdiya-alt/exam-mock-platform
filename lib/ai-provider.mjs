// Provider-neutral JSON generation for the background worker.
//
// Free-first: Gemini (Google AI Studio free tier, no billing needed) is used whenever a Gemini key is
// configured. OpenAI is used only when it is selected with AI_PROVIDER=openai or when it is the only key.
//
// One worker invocation has a 60 s budget, so every model call gets whatever is left of that budget
// (`deadlineAt`) instead of a fixed short timeout. The old fixed 12 s timeout was too short for a free-tier
// model writing a batch of bilingual questions and caused most "timed out" task failures.

export const GEMINI_DEFAULT_MODEL = "gemini-3.6-flash";
export const OPENAI_DEFAULT_MODEL = "gpt-6-luna";

const TRANSIENT_STATUSES = [500, 502, 503, 504];
const MAX_ATTEMPTS = 2;
const MAX_ATTEMPT_MS = 40_000;
const MIN_ATTEMPT_MS = 6_000;
const SAFETY_MARGIN_MS = 2_000;

export function getAiConfig(env = process.env) {
  const geminiKey = String(env.GEMINI_API_KEY_2 || env.GEMINI_API_KEY || "").trim();
  const openaiKey = String(env.OPENAI_API_KEY || "").trim();
  const wanted = String(env.AI_PROVIDER || "").trim().toLowerCase();
  const gemini = () => ({ provider: "gemini", apiKey: geminiKey, model: String(env.GEMINI_MODEL || "").trim() || GEMINI_DEFAULT_MODEL });
  const openai = () => ({ provider: "openai", apiKey: openaiKey, model: String(env.OPENAI_MODEL || "").trim() || OPENAI_DEFAULT_MODEL });

  if (wanted === "openai") return openaiKey ? openai() : null;
  if (wanted === "gemini") return geminiKey ? gemini() : null;
  if (geminiKey) return gemini();
  if (openaiKey) return openai();
  return null;
}

export function missingAiKeyMessage() {
  return "No AI key is configured. Add a free GEMINI_API_KEY (Google AI Studio, no billing needed) to the server environment.";
}

function providerLabel(ai) {
  return ai.provider === "gemini" ? "Gemini" : "OpenAI";
}

function buildRequest(ai, prompt, maxOutputTokens) {
  if (ai.provider === "gemini") {
    return {
      url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(ai.model)}:generateContent`,
      headers: { "content-type": "application/json", "x-goog-api-key": ai.apiKey },
      body: {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", maxOutputTokens }
      }
    };
  }
  return {
    url: "https://api.openai.com/v1/responses",
    headers: { "content-type": "application/json", authorization: `Bearer ${ai.apiKey}` },
    body: { model: ai.model, input: prompt, text: { format: { type: "json_object" } }, max_output_tokens: maxOutputTokens }
  };
}

function extractGeminiText(body) {
  const candidate = body?.candidates?.[0];
  if (candidate?.finishReason === "MAX_TOKENS") {
    throw new Error("Gemini response was cut off (MAX_TOKENS); no questions were staged.");
  }
  if (!candidate && body?.promptFeedback?.blockReason) {
    throw new Error(`Gemini blocked the prompt (${String(body.promptFeedback.blockReason).slice(0, 60)}); no questions were staged.`);
  }
  return (candidate?.content?.parts || []).map((part) => part?.text || "").join("");
}

function extractOpenAIText(body) {
  if (body?.status === "incomplete") throw new Error("OpenAI response was incomplete; no questions were staged.");
  if (typeof body?.output_text === "string") return body.output_text;
  return (body?.output || []).flatMap((item) => item.content || [])
    .filter((item) => item.type === "output_text" && typeof item.text === "string")
    .map((item) => item.text).join("");
}

function parseJson(text, label) {
  const cleaned = String(text || "").replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
  try { return JSON.parse(cleaned); }
  catch { throw new Error(`${label} response was not valid JSON; no questions were staged.`); }
}

function timeoutFailure(label, ai, attempts) {
  const error = new Error(`${label} request timed out after ${attempts} bounded attempt${attempts === 1 ? "" : "s"}.`);
  error.status = 504;
  error.code = `${ai.provider.toUpperCase()}_TRANSIENT_FAILURE`;
  return error;
}

async function attemptOnce(ai, prompt, maxOutputTokens, timeoutMs, fetchImpl) {
  const label = providerLabel(ai);
  const request = buildRequest(ai, prompt, maxOutputTokens);
  const response = await fetchImpl(request.url, {
    method: "POST",
    headers: request.headers,
    body: JSON.stringify(request.body),
    signal: AbortSignal.timeout(timeoutMs)
  });
  if (!response.ok) {
    let detail = "";
    try {
      const failureBody = await response.json();
      detail = failureBody?.error?.message ? `: ${String(failureBody.error.message).slice(0, 300)}` : "";
    } catch { /* The HTTP status is the actionable part. */ }
    const failure = new Error(`${label} API returned HTTP ${response.status}${detail}.`);
    failure.status = response.status;
    if (response.status === 429) failure.code = "FREE_QUOTA_EXHAUSTED";
    throw failure;
  }
  const body = await response.json();
  const text = ai.provider === "gemini" ? extractGeminiText(body) : extractOpenAIText(body);
  return parseJson(text, label);
}

export async function callAiJson(ai, prompt, maxOutputTokens = 16000, options = {}) {
  const {
    fetchImpl = fetch,
    now = () => Date.now(),
    sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
  } = options;
  const deadlineAt = options.deadlineAt ?? ai.deadlineAt ?? now() + 50_000;
  const label = providerLabel(ai);
  let attempts = 0;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const timeoutMs = Math.min(MAX_ATTEMPT_MS, deadlineAt - now() - SAFETY_MARGIN_MS);
    if (timeoutMs < MIN_ATTEMPT_MS) throw timeoutFailure(label, ai, attempts);
    attempts += 1;
    try {
      return await attemptOnce(ai, prompt, maxOutputTokens, timeoutMs, fetchImpl);
    } catch (error) {
      const timedOut = error?.name === "TimeoutError" || error?.name === "AbortError";
      const retryable = timedOut || TRANSIENT_STATUSES.includes(error?.status);
      if (retryable && attempt < MAX_ATTEMPTS) {
        await sleep(500 * (2 ** (attempt - 1)));
        continue;
      }
      if (timedOut) throw timeoutFailure(label, ai, attempts);
      throw error;
    }
  }
  throw timeoutFailure(label, ai, attempts);
}
