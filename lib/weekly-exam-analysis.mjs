export function normalizeQuestionText(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLocaleLowerCase("en")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

const TEXT_LIMITS = {
  subject: 100,
  topic: 140,
  question_hi: 1200,
  question_en: 1200,
  explanation_hi: 1800,
  explanation_en: 1800,
};

function isSafeText(value, maxLength) {
  return typeof value === "string"
    && value.trim().length > 0
    && value.trim().length <= maxLength
    && !/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(value);
}

export function validateGeneratedQuestion(question) {
  if (!question || typeof question !== "object" || Array.isArray(question)) return false;

  for (const [field, maxLength] of Object.entries(TEXT_LIMITS)) {
    if (!isSafeText(question[field], maxLength)) return false;
  }

  if (!Array.isArray(question.options) || question.options.length !== 4) return false;
  if (question.options.some((value) => !isSafeText(value, 300))) return false;
  const normalizedOptions = question.options.map(normalizeQuestionText);
  if (normalizedOptions.some((value) => !value) || new Set(normalizedOptions).size !== 4) return false;
  if (!Number.isInteger(question.answer_index) || question.answer_index < 0 || question.answer_index > 3) return false;
  if (!["easy", "medium", "hard"].includes(question.difficulty)) return false;

  // Refuse obvious malformed model output. This is structural validation only;
  // it cannot establish factual correctness or replace a human review.
  if (/<\/?(?:script|iframe|object|embed)\b/i.test([
    question.subject, question.topic, question.question_hi, question.question_en,
    ...question.options, question.explanation_hi, question.explanation_en
  ].join(" "))) return false;

  return true;
}

export function dedupeGeneratedQuestions(candidates, existingEnglish = [], existingHindi = []) {
  const seenEnglish = new Set(existingEnglish.map(normalizeQuestionText).filter(Boolean));
  const seenHindi = new Set(existingHindi.map(normalizeQuestionText).filter(Boolean));
  const result = [];
  for (const question of candidates || []) {
    if (!validateGeneratedQuestion(question)) continue;
    const en = normalizeQuestionText(question.question_en);
    const hi = normalizeQuestionText(question.question_hi);
    if (!en || !hi || seenEnglish.has(en) || seenHindi.has(hi)) continue;
    seenEnglish.add(en);
    seenHindi.add(hi);
    result.push(question);
  }
  return result;
}

export function buildExamAnalysisSummary({ examName, existingQuestions, generatedQuestions, patternAnalysis }) {
  const topics = new Map();
  const difficulties = { easy: 0, medium: 0, hard: 0 };
  for (const question of [...(existingQuestions || []), ...(generatedQuestions || [])]) {
    const subject = question.subject || "Unclassified";
    const topic = question.topic || "Unclassified";
    const key = subject + " — " + topic;
    topics.set(key, (topics.get(key) || 0) + 1);
    if (Object.hasOwn(difficulties, question.difficulty)) difficulties[question.difficulty] += 1;
  }
  return {
    exam_name: examName,
    analyzed_question_count: (existingQuestions || []).length,
    generated_question_count: (generatedQuestions || []).length,
    topic_breakdown: Object.fromEntries([...topics.entries()].sort((a, b) => b[1] - a[1])),
    difficulty_breakdown: difficulties,
    pattern_analysis: String(patternAnalysis || "").slice(0, 12000),
  };
}
