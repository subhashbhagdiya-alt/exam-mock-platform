// Best-effort in-memory sliding-window rate limiter.
// On serverless platforms every instance keeps its own counters, so this slows
// abuse but is not a global guarantee. Use a shared store (Upstash/Supabase)
// if strict limits are needed.
export function createRateLimiter({ limit, windowMs, maxKeys = 5000, now = () => Date.now() }) {
  const hits = new Map();
  return function check(key) {
    const current = now();
    const cutoff = current - windowMs;
    const recent = (hits.get(key) || []).filter((timestamp) => timestamp > cutoff);
    if (recent.length >= limit) {
      hits.set(key, recent);
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((recent[0] + windowMs - current) / 1000))
      };
    }
    recent.push(current);
    // Re-insert so the Map's insertion order tracks least-recently-used keys.
    hits.delete(key);
    hits.set(key, recent);
    if (hits.size > maxKeys) hits.delete(hits.keys().next().value);
    return { allowed: true, remaining: limit - recent.length };
  };
}

export function getClientIp(headers) {
  const forwarded = headers.get("x-forwarded-for");
  const first = forwarded ? forwarded.split(",")[0].trim() : "";
  return first || headers.get("x-real-ip") || "unknown";
}
