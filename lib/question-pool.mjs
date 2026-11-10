// Stable text normalization for duplicate detection. Keep mathematical operators,
 // percentages, digits, currency signs and punctuation inside expressions intact.
export function normalizeQuestionText(value) {
  return String(value || "")
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("en")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[?!.।]+$/u, "")
    .replace(/\s+/gu, "")
    .trim();
}

export function dedupeQuestionRows(rows) {
  const sourceRank = { official: 0, pyq: 1, memory_based: 2, curated: 3 };
  const candidates = [...(rows || [])].sort((a, b) => {
    const aSource = sourceRank[a?.source_type] ?? 4;
    const bSource = sourceRank[b?.source_type] ?? 4;
    if (aSource !== bSource) return aSource - bSource;

    const aComplete = Boolean(a?.explanation_hi?.trim() && a?.explanation_en?.trim());
    const bComplete = Boolean(b?.explanation_hi?.trim() && b?.explanation_en?.trim());
    if (aComplete !== bComplete) return aComplete ? -1 : 1;

    const aExplanationLength = (a?.explanation_hi?.length || 0) + (a?.explanation_en?.length || 0);
    const bExplanationLength = (b?.explanation_hi?.length || 0) + (b?.explanation_en?.length || 0);
    if (aExplanationLength !== bExplanationLength) return bExplanationLength - aExplanationLength;

    return String(a?.created_at || "").localeCompare(String(b?.created_at || ""))
      || String(a?.id || "").localeCompare(String(b?.id || ""));
  });
  const seenEnglish = new Set();
  const seenHindi = new Set();
  const unique = [];
  for (const row of candidates) {
    const english = normalizeQuestionText(row?.question_en);
    const hindi = normalizeQuestionText(row?.question_hi);
    if ((english && seenEnglish.has(english)) || (hindi && seenHindi.has(hindi))) continue;
    if (english) seenEnglish.add(english);
    if (hindi) seenHindi.add(hindi);
    unique.push(row);
  }
  return unique;
}

export function mergeQuestionIds(...sources) {
  const ids = new Set();
  for (const source of sources) {
    if (!Array.isArray(source)) continue;
    for (const id of source) {
      if (typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
        ids.add(id.toLowerCase());
      }
    }
  }
  return [...ids].slice(-1000);
}

export function getLocalizedQuestionOptions(question, language) {
  const localized = language === "hi" ? question?.optionsHi : question?.optionsEn;
  if (Array.isArray(localized) && localized.length === 4) return localized;
  const options = Array.isArray(question?.options) ? question.options : [];
  return options.map((option) => {
    if (typeof option !== "string") return option;
    const parts = option.split(" / ");
    return parts.length === 2 ? parts[language === "hi" ? 0 : 1] : option;
  });
}
