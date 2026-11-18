import { UUID_RE } from "./uuid.mjs";

export function validateResultQuestionMapping(questionIds, totalQuestions) {
  if (!questionIds || typeof questionIds !== "object" || Array.isArray(questionIds)) {
    throw new Error("Invalid question mapping");
  }

  const mappedIds = Object.values(questionIds);
  if (!mappedIds.length || mappedIds.length > 100 || mappedIds.some(id => typeof id !== "string" || !UUID_RE.test(id))) {
    throw new Error("Invalid question mapping");
  }

  const sourceIds = mappedIds.map(id => id.toLowerCase());
  if (new Set(sourceIds).size !== sourceIds.length) {
    throw new Error("Duplicate question ids are not allowed");
  }

  if (!Number.isInteger(Number(totalQuestions)) || Number(totalQuestions) !== sourceIds.length) {
    throw new Error("Question count does not match result payload");
  }

  return sourceIds;
}
