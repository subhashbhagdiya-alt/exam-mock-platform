const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateResultQuestionMapping(questionIds, totalQuestions) {
  if (!questionIds || typeof questionIds !== "object" || Array.isArray(questionIds)) {
    throw new Error("Invalid question mapping");
  }

  const mappedIds = Object.values(questionIds);
  if (!mappedIds.length || mappedIds.some(id => typeof id !== "string" || !UUID_RE.test(id))) {
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
