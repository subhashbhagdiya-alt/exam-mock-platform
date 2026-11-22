import { isUuid } from "./uuid.mjs";

export function isValidGradeSubmission(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return false;
  if (!isUuid(body.test_session_id) || !isUuid(body.test_session_key)) return false;
  if (!body.answers || typeof body.answers !== "object" || Array.isArray(body.answers)) return false;

  const entries = Object.entries(body.answers);
  if (entries.length > 100) return false;
  return entries.every(([key, value]) => {
    if (!/^(?:[1-9]|[1-9][0-9]|100)$/.test(key)) return false;
    return value === null || value === "" ||
      (Number.isInteger(Number(value)) && Number(value) >= 0 && Number(value) <= 3 &&
       (typeof value === "number" || (typeof value === "string" && /^[0-3]$/.test(value))));
  });
}
