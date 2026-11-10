export function shuffleOptionOrder(length = 4, random = Math.random) {
  if (!Number.isInteger(length) || length < 2 || length > 10) {
    throw new RangeError("Option count must be an integer between 2 and 10.");
  }
  const order = Array.from({ length }, (_, index) => index);
  for (let index = order.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [order[index], order[swapIndex]] = [order[swapIndex], order[index]];
  }
  return order;
}

// The order maps each displayed option position to its original question-bank index.
export function reorderOptions(options, optionOrder) {
  if (!Array.isArray(options) || !Array.isArray(optionOrder) || options.length !== optionOrder.length) {
    throw new TypeError("Options and option order must be matching arrays.");
  }
  if (new Set(optionOrder).size !== optionOrder.length ||
      optionOrder.some(index => !Number.isInteger(index) || index < 0 || index >= options.length)) {
    throw new TypeError("Option order must be a permutation of the option indexes.");
  }
  return optionOrder.map(index => options[index]);
}

export function mapDisplayedAnswersToOriginal(answers, optionOrders) {
  const mapped = {};
  for (const [questionId, selectedIndex] of Object.entries(answers || {})) {
    if (selectedIndex === undefined || selectedIndex === null || selectedIndex === "") continue;
    const order = optionOrders?.[questionId];
    if (!Array.isArray(order) || !Number.isInteger(Number(selectedIndex)) ||
        Number(selectedIndex) < 0 || Number(selectedIndex) >= order.length) {
      throw new TypeError("A selected answer has no valid option-order mapping.");
    }
    mapped[questionId] = order[Number(selectedIndex)];
  }
  return mapped;
}

export function mapOriginalReviewToDisplayed(review, optionOrders) {
  return (review || []).map(item => {
    const order = optionOrders?.[String(item.id)];
    if (!Array.isArray(order)) return item;
    if (item.answer === undefined || item.answer === null) return item;
    const displayedIndex = order.indexOf(Number(item.answer));
    if (displayedIndex < 0) throw new TypeError("The graded answer is outside the option-order mapping.");
    return { ...item, answer: displayedIndex };
  });
}
