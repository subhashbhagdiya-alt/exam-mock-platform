function normalizeLabel(value, fallback) {
  const label = String(value || "").trim().replace(/\s+/g, " ");
  return label || fallback;
}

function normalizeSourceKey(value) {
  return String(value || "").trim().toLocaleLowerCase("en");
}

/**
 * Rank question-bank topics using traceable source coverage, never raw
 * prediction_score values (which are not calibrated consistently per exam).
 */
export function buildQuestionTopicSignals(questions, limit = 5) {
  const buckets = new Map();

  for (const question of Array.isArray(questions) ? questions : []) {
    const subject = normalizeLabel(question?.subject, "Unclassified");
    const topic = normalizeLabel(question?.topic, "Unclassified");
    const key = subject.toLocaleLowerCase("en") + "\u0000" + topic.toLocaleLowerCase("en");

    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {
        subject,
        topic,
        question_count: 0,
        pyq_question_count: 0,
        official_question_count: 0,
        memory_based_question_count: 0,
        curated_question_count: 0,
        pyq_sources: new Set(),
        official_sources: new Set(),
        memory_based_sources: new Set(),
      };
      buckets.set(key, bucket);
    }

    bucket.question_count += 1;
    const sourceType = String(question?.source_type || "unknown").trim().toLowerCase();
    const sourceKey = normalizeSourceKey(question?.source_name)
      || normalizeSourceKey(question?.source_url);

    if (sourceType === "pyq") {
      bucket.pyq_question_count += 1;
      if (sourceKey) bucket.pyq_sources.add(sourceKey);
    } else if (sourceType === "official") {
      bucket.official_question_count += 1;
      if (sourceKey) bucket.official_sources.add(sourceKey);
    } else if (sourceType === "memory_based") {
      bucket.memory_based_question_count += 1;
      if (sourceKey) bucket.memory_based_sources.add(sourceKey);
    } else if (sourceType === "curated") {
      bucket.curated_question_count += 1;
    }
  }

  const ranked = [...buckets.values()].map((bucket) => {
    const pyq_paper_count = bucket.pyq_sources.size;
    const official_source_count = bucket.official_sources.size;
    const memory_based_source_count = bucket.memory_based_sources.size;

    return {
      subject: bucket.subject,
      topic: bucket.topic,
      question_count: bucket.question_count,
      pyq_question_count: bucket.pyq_question_count,
      pyq_paper_count,
      official_question_count: bucket.official_question_count,
      official_source_count,
      memory_based_question_count: bucket.memory_based_question_count,
      memory_based_source_count,
      curated_question_count: bucket.curated_question_count,
      signal_type: pyq_paper_count > 0
        ? "pyq"
        : official_source_count > 0
          ? "official"
          : memory_based_source_count > 0
            ? "memory_based"
            : "practice_only",
    };
  });

  ranked.sort((a, b) =>
    b.pyq_paper_count - a.pyq_paper_count
    || b.pyq_question_count - a.pyq_question_count
    || b.official_source_count - a.official_source_count
    || b.official_question_count - a.official_question_count
    || b.memory_based_source_count - a.memory_based_source_count
    || b.memory_based_question_count - a.memory_based_question_count
    || b.curated_question_count - a.curated_question_count
    || a.subject.localeCompare(b.subject)
    || a.topic.localeCompare(b.topic)
  );

  const safeLimit = Number.isFinite(Number(limit))
    ? Math.max(0, Math.min(50, Math.floor(Number(limit))))
    : 5;
  return ranked.slice(0, safeLimit);
}
