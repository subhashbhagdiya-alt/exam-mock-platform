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

  // This is structural validation only; factual correctness still needs human review.
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


/**
 * Bound the amount of stored question/source text sent to the free-tier model.
 * Keep aggregate counts intact while sampling only a small, representative set.
 */
export function buildWeeklyEvidence(context, {
  maxTopics = 25,
  maxHistoricalQuestions = 12,
  maxSources = 12,
  maxTextLength = 260,
} = {}) {
  const trim = (value, limit = maxTextLength) => String(value || "").trim().slice(0, limit);
  const topicCounts = Object.entries(context?.topicCounts || {})
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .slice(0, maxTopics)
    .map(([topic, count]) => ({ topic: trim(topic, 140), count: Number(count) || 0 }));

  const historical = Array.isArray(context?.historicalEvidence) ? context.historicalEvidence : [];
  const sources = Array.isArray(context?.sources) ? context.sources : [];

  return {
    active_question_count: Array.isArray(context?.active) ? context.active.length : 0,
    topic_counts: topicCounts,
    difficulty_counts: context?.difficultyCounts || {},
    actual_pyq_or_official_question_count: historical.length,
    actual_past_question_sample: historical.slice(0, maxHistoricalQuestions).map((q) => ({
      subject: trim(q.subject, 80),
      topic: trim(q.topic, 100),
      question_hi: trim(q.question_hi),
      question_en: trim(q.question_en),
      options: Array.isArray(q.options) ? q.options.slice(0, 4).map((option) => trim(option, 100)) : [],
      answer_index: Number.isInteger(q.answer_index) ? q.answer_index : null,
      source_type: trim(q.source_type, 30),
      source_name: trim(q.source_name, 100),
      source_url: trim(q.source_url, 220),
    })),
    official_source_references: sources.slice(0, maxSources).map((source) => ({
      board: trim(source.board, 60),
      name: trim(source.name, 100),
      url: trim(source.url, 220),
    })),
  };
}
