export function createOptionOrder(length = 4, random = Math.random) {
  if (!Number.isInteger(length) || length < 1 || length > 26) {
    throw new RangeError("Option count must be an integer between 1 and 26.");
  }
  if (typeof random !== "function") {
    throw new TypeError("Random source must be a function.");
  }

  const order = Array.from({ length }, (_, index) => index);
  for (let index = order.length - 1; index > 0; index -= 1) {
    const sample = Number(random());
    const normalized = Number.isFinite(sample)
      ? Math.min(Math.max(sample, 0), 1 - Number.EPSILON)
      : 0;
    const swapIndex = Math.floor(normalized * (index + 1));
    [order[index], order[swapIndex]] = [order[swapIndex], order[index]];
  }
  return order;
}

export function applyOptionOrder(options, optionOrder) {
  if (!Array.isArray(options) || !Array.isArray(optionOrder) || options.length !== optionOrder.length) {
    throw new TypeError("Options and option order must be arrays of equal length.");
  }
  const validPermutation = optionOrder.every(
    (value) => Number.isInteger(value) && value >= 0 && value < options.length
  ) && new Set(optionOrder).size === options.length;
  if (!validPermutation) {
    throw new RangeError("Option order must be a permutation of the option indexes.");
  }
  return optionOrder.map((originalIndex) => options[originalIndex]);
}

export function toOriginalAnswer(displayedIndex, optionOrder) {
  if (!Number.isInteger(displayedIndex) || !Array.isArray(optionOrder)
    || displayedIndex < 0 || displayedIndex >= optionOrder.length) {
    return null;
  }
  const originalIndex = optionOrder[displayedIndex];
  return Number.isInteger(originalIndex) ? originalIndex : null;
}

export function toDisplayAnswer(originalIndex, optionOrder) {
  if (!Number.isInteger(originalIndex) || !Array.isArray(optionOrder)) return null;
  const displayedIndex = optionOrder.indexOf(originalIndex);
  return displayedIndex >= 0 ? displayedIndex : null;
}

export function mapDisplayedAnswersToOriginal(answers, questions) {
  if (!answers || typeof answers !== "object" || Array.isArray(answers) || !Array.isArray(questions)) {
    throw new TypeError("Answers and questions must be provided.");
  }

  const mapped = {};
  for (const question of questions) {
    const displayedIndex = answers[question.id];
    if (displayedIndex === undefined || displayedIndex === null || displayedIndex === "") continue;
    const originalIndex = toOriginalAnswer(Number(displayedIndex), question.optionOrder);
    if (originalIndex === null) {
      throw new RangeError(`Invalid selected option for question ${question.id}.`);
    }
    mapped[String(question.id)] = originalIndex;
  }
  return mapped;
}
