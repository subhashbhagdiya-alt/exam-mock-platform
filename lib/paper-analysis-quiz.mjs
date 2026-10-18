/**
 * Score the uploaded-paper practice quiz without trusting the caller's answer map.
 * Answers are zero-based option indexes keyed by question position.
 */
export function scorePaperQuiz(questions, answers) {
  const items = Array.isArray(questions) ? questions : [];
  const selections = answers && typeof answers === "object" && !Array.isArray(answers)
    ? answers
    : {};
  let answered = 0;
  let correct = 0;
  let incorrect = 0;

  items.forEach((question, index) => {
    if (!Object.prototype.hasOwnProperty.call(selections, index)) return;
    const selected = selections[index];
    if (!Number.isInteger(selected) || selected < 0 || selected > 3) return;

    answered += 1;
    if (selected === question?.answer_index) correct += 1;
    else incorrect += 1;
  });

  const total = items.length;
  return {
    total,
    answered,
    correct,
    incorrect,
    unanswered: Math.max(0, total - answered),
    percentage: total ? Math.round((correct / total) * 100) : 0
  };
}
