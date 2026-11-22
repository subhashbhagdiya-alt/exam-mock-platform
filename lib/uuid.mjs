// Shared UUID check. Accepts RFC 4122/9562 versions 1-8 so time-ordered UUIDv7
// values (e.g. from Postgres uuidv7()) are not rejected.
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value) {
  return typeof value === "string" && UUID_RE.test(value);
}
