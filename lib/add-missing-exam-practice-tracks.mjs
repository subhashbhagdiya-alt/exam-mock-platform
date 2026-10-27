const KNOWN_PRACTICE_EXAMS = {
  "mpesb-general": {
    exam_board: "MPESB",
    name_hi: "MPESB सामान्य अभ्यास",
    name_en: "MPESB General Practice",
  },
  "ssc-general": {
    exam_board: "SSC",
    name_hi: "SSC सामान्य अभ्यास",
    name_en: "SSC General Practice",
  },
};

function readableSlug(slug) {
  return String(slug || "")
    .split("-")
    .filter(Boolean)
    .map((part) => part.toUpperCase() === "MPESB" || part.toUpperCase() === "SSC"
      ? part.toUpperCase()
      : part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/**
 * Keep active exams discoverable even when job_tracks metadata is missing.
 * Fallbacks intentionally contain no official URLs, dates, or application claims.
 */
export function addMissingExamPracticeTracks(tracks, activeExams) {
  const existingExamSlugs = new Set((tracks || []).map((track) => track.exam_slug).filter(Boolean));
  const fallbacks = (activeExams || [])
    .filter((exam) => exam?.slug && !existingExamSlugs.has(exam.slug))
    .map((exam) => {
      const known = KNOWN_PRACTICE_EXAMS[exam.slug] || {};
      const name = readableSlug(exam.slug);
      const board = known.exam_board || (String(exam.slug).toLowerCase().startsWith("ssc-") ? "SSC"
        : String(exam.slug).toLowerCase().startsWith("mpesb-") ? "MPESB" : "OTHER");
      return {
        id: `fallback-exam-${exam.id || exam.slug}`,
        exam_board: board,
        slug: `practice-${exam.slug}`,
        name_hi: known.name_hi || `${name} अभ्यास`,
        name_en: known.name_en || `${name} Practice`,
        description_hi: "अभ्यास विकल्प। भर्ती की आधिकारिक जानकारी अभी सेट नहीं है; आधिकारिक सूचना संबंधित बोर्ड से जाँचें।",
        description_en: "Practice option. Recruitment metadata is not configured; verify official details with the relevant board.",
        status: "practice",
        exam_slug: exam.slug,
        exam_category: "general",
        official_url: null,
        exam_date_text: null,
        form_status_text: null,
        last_verified_at: null,
        verified_question_count: null,
        required_question_count: Number(exam.total_questions || 0),
        question_bank_ready: false,
        question_bank_check_available: false,
        question_bank_status: "server_credentials_required",
        pyq_question_count: null,
        official_question_count: null,
        practice_question_count: null,
        subjects: [],
        topics: [],
        analysis_candidates: [],
        effective_status: "practice",
        metadata_fallback: true,
      };
    });
  return [...(tracks || []), ...fallbacks];
}
