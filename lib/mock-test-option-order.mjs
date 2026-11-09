export function createOptionOrder(random = Math.random) {
  const order = [0, 1, 2, 3];
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

export function isValidOptionOrder(order) {
  return Array.isArray(order)
    && order.length === 4
    && order.every((value) => Number.isInteger(value) && value >= 0 && value <= 3)
    && new Set(order).size === 4;
}

export function applyOptionOrder(options, order) {
  if (!Array.isArray(options) || options.length !== 4 || !isValidOptionOrder(order)) {
    throw new TypeError("Expected four options and a valid option-order permutation.");
  }
  return order.map((originalIndex) => options[originalIndex]);
}

export function getOriginalAnswerIndex(order, displayIndex) {
  if (!isValidOptionOrder(order) || !Number.isInteger(displayIndex) || displayIndex < 0 || displayIndex > 3) {
    throw new TypeError("Invalid display option mapping.");
  }
  return order[displayIndex];
}

export function getDisplayAnswerIndex(order, originalIndex) {
  if (!isValidOptionOrder(order) || !Number.isInteger(originalIndex) || originalIndex < 0 || originalIndex > 3) {
    throw new TypeError("Invalid original answer mapping.");
  }
  return order.indexOf(originalIndex);
}
