export function normalizeQuestionText(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLocaleLowerCase("en")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function validateGeneratedQuestion(question) {
  if (!question || typeof question !== "object") return false;
  const requiredText = [
    question.subject,
    question.topic,
    question.question_hi,
    question.question_en,
    question.explanation_hi,
    question.explanation_en,
  ];
  if (requiredText.some((value) => typeof value !== "string" || !value.trim())) return false;
  if (!Array.isArray(question.options) || question.options.length !== 4) return false;
  if (question.options.some((value) => typeof value !== "string" || !value.trim())) return false;
  if (new Set(question.options.map(normalizeQuestionText)).size !== 4) return false;
  if (!Number.isInteger(question.answer_index) || question.answer_index < 0 || question.answer_index > 3) return false;
  if (!["easy", "medium", "hard"].includes(question.difficulty)) return false;
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

export function buildGeminiRequestOptions(maxOutputTokens, enableWebSearch = false) {
  return {
    generationConfig: {
      ...(!enableWebSearch ? { responseMimeType: "application/json" } : {}),
      maxOutputTokens,
    },
    ...(enableWebSearch ? { tools: [{ google_search: {} }] } : {}),
  };
}
