// Public API responses must not expose raw database, driver, or provider messages.
// Keep diagnostic detail in server logs and return a stable generic response to clients.
export function publicDbError(label, error, status = 500) {
  console.error(`[api] ${label} failed:`, error?.code || "", error?.message || "");
  return Response.json({
    error: `${label} is temporarily unavailable. Please try again.`,
    code: "UPSTREAM_DATA_ERROR"
  }, { status });
}

// Distinguishes a failed data-store read from deliberate, user-facing validation errors.
export class DataAccessError extends Error {
  constructor(label, cause) {
    super(`${label} failed`);
    this.name = "DataAccessError";
    this.label = label;
    this.cause = cause;
  }
}
