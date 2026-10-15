export function normalizeCategory(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
}

function displayLabelScore(value) {
  return String(value ?? "").trim().split(/\s+/).filter(token => {
    const letters = token.match(/\p{L}/u);
    if (!letters) return false;
    const first = letters[0];
    return first === first.toLocaleUpperCase("en-US")
      && first !== first.toLocaleLowerCase("en-US")
      && token !== token.toLocaleUpperCase("en-US");
  }).length;
}

function chooseDisplayLabel(variants) {
  return [...variants.entries()]
    .sort(([labelA, countA], [labelB, countB]) =>
      displayLabelScore(labelB) - displayLabelScore(labelA)
      || countB - countA
      || labelA.localeCompare(labelB, "en", { sensitivity: "base" })
      || labelA.localeCompare(labelB)
    )[0]?.[0] || "";
}

function collectVariants(values) {
  const groups = new Map();
  for (const value of values) {
    const label = String(value ?? "").trim().replace(/\s+/g, " ");
    const key = normalizeCategory(label);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, new Map());
    const variants = groups.get(key);
    variants.set(label, (variants.get(label) || 0) + 1);
  }
  return groups;
}

/**
 * Builds clean subject/topic choices by merging case and whitespace variants
 * while keeping the selected display label traceable to the stored category.
 */
export function buildQuestionCatalog(rows) {
  const subjectVariants = collectVariants(rows.map(row => row.subject));
  const subjectLabels = new Map(
    [...subjectVariants.entries()].map(([key, variants]) => [key, chooseDisplayLabel(variants)])
  );

  const pairGroups = new Map();
  for (const row of rows) {
    const subjectKey = normalizeCategory(row.subject);
    const topicKey = normalizeCategory(row.topic);
    if (!subjectKey || !topicKey) continue;

    const pairKey = JSON.stringify([subjectKey, topicKey]);
    if (!pairGroups.has(pairKey)) {
      pairGroups.set(pairKey, {
        subjectKey,
        topicVariants: new Map()
      });
    }
    const group = pairGroups.get(pairKey);
    const topicLabel = String(row.topic ?? "").trim().replace(/\s+/g, " ");
    group.topicVariants.set(topicLabel, (group.topicVariants.get(topicLabel) || 0) + 1);
  }

  const subjects = [...subjectLabels.values()].sort((a, b) =>
    a.localeCompare(b, "en", { sensitivity: "base" }) || a.localeCompare(b)
  );
  const subject_topics = [...pairGroups.values()]
    .map(group => ({
      subject: subjectLabels.get(group.subjectKey) || "",
      topic: chooseDisplayLabel(group.topicVariants)
    }))
    .filter(item => item.subject && item.topic)
    .sort((a, b) =>
      a.subject.localeCompare(b.subject, "en", { sensitivity: "base" })
      || a.topic.localeCompare(b.topic, "en", { sensitivity: "base" })
    );

  return { subjects, subject_topics };
}
