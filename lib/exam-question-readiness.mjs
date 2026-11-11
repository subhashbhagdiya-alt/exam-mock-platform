import { dedupeQuestionRows } from "./question-pool.mjs";

/**
 * Derive test readiness from distinct verified question content, not raw rows.
 * This deliberately uses the same de-duplication helper as the practice API.
 */
export function summarizeExamQuestionBank(rows, requiredQuestions) {
  const inputRows = Array.isArray(rows) ? rows : [];
  const uniqueRows = dedupeQuestionRows(inputRows);
  const requested = Number(requiredQuestions);
  const requiredQuestionCount = Number.isInteger(requested) && requested > 0 ? requested : 0;
  const verifiedQuestionCount = uniqueRows.length;

  return {
    rawQuestionCount: inputRows.length,
    verifiedQuestionCount,
    requiredQuestionCount,
    questionBankReady: requiredQuestionCount > 0 && verifiedQuestionCount >= requiredQuestionCount,
    uniqueRows,
  };
}
