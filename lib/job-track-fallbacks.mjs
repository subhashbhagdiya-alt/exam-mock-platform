import { buildQuestionTopicSignals } from "./question-topic-signals.mjs";

export function inferExamBoard(exam) {
  const slug = String(exam?.slug || "").toLowerCase();
  const name = String(exam?.name || "").toLowerCase();
  if (slug.startsWith("mpesb-") || slug === "mpesb" || name.includes("madhya pradesh esb")) return "MPESB";
  if (slug.startsWith("ssc-") || name.startsWith("ssc ")) return "SSC";
  if (slug.startsWith("rpf-") || name.includes("railway protection force")) return "RPF";
  if (slug.startsWith("rrb-") || name.includes("railway recruitment")) return "RRB";
  return "OTHER";
}

export function getUnlinkedActiveExams(activeExams, tracks) {
  const linkedExamSlugs = new Set((tracks || []).map((track) => track?.exam_slug).filter(Boolean));
  return (activeExams || []).filter((exam) => exam?.slug && !linkedExamSlugs.has(exam.slug));
}

export function buildUnlinkedExamTrack(exam, index, stats) {
  const board = inferExamBoard(exam);
  const verifiedQuestionCount = stats.verifiedCounts.get(exam.id) || 0;
  const requiredQuestionCount = Number(exam.total_questions || 0);
  const questionBankReady = requiredQuestionCount > 0 && verifiedQuestionCount >= requiredQuestionCount;
  const sourceCount = (type) => stats.sourceCounts.get(`${exam.id}:${type}`) || 0;
  const subjects = [...(stats.subjectSets.get(exam.id) || new Set())].sort();
  const topics = [...(stats.topicSets.get(exam.id) || new Set())].sort();

  const nameHi = board === "MPESB"
    ? "एमपीईएसबी सामान्य अभ्यास"
    : board === "SSC"
      ? "एसएससी सामान्य अभ्यास"
      : exam.name;
  const descriptionHi = board === "MPESB"
    ? "मध्य प्रदेश कर्मचारी चयन मंडल की परीक्षाओं के लिए सामान्य अभ्यास प्रश्न।"
    : board === "SSC"
      ? "कर्मचारी चयन आयोग की परीक्षाओं के लिए सामान्य प्रतियोगी अभ्यास प्रश्न।"
      : exam.description || "सामान्य प्रतियोगी परीक्षा अभ्यास प्रश्न।";

  return {
    id: exam.id,
    exam_board: board,
    slug: exam.slug,
    name_hi: nameHi,
    name_en: exam.name,
    description_hi: descriptionHi,
    description_en: exam.description || "General competitive-exam practice.",
    status: questionBankReady ? "question_bank_ready" : "practice",
    exam_slug: exam.slug,
    active: true,
    sort_order: 100000 + index,
    exam_category: "recruitment",
    official_url: null,
    exam_date_text: null,
    form_status_text: null,
    verified_question_count: verifiedQuestionCount,
    required_question_count: requiredQuestionCount,
    question_bank_ready: questionBankReady,
    pyq_question_count: sourceCount("pyq"),
    official_question_count: sourceCount("official"),
    practice_question_count: sourceCount("curated"),
    subjects,
    topics,
    analysis_candidates: buildQuestionTopicSignals(stats.topicSignalRows.get(exam.id) || [], 5),
    effective_status: questionBankReady ? "question_bank_ready" : "practice",
    is_general_practice: true
  };
}
