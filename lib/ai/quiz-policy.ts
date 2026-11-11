export type QuizDifficulty = "easy" | "medium" | "hard" | "mixed";

export function normalizeQuizDifficulty(value: unknown): QuizDifficulty {
  return value === "medium" || value === "hard" || value === "mixed" ? value : "easy";
}

export function normalizeQuizCount(count: unknown, isPremium: boolean) {
  const maxAllowed = isPremium ? 50 : 30;
  const numeric = Number(count);
  const safe = Number.isFinite(numeric) ? numeric : 10;
  const stepped = Math.round(safe / 5) * 5;
  return Math.min(Math.max(stepped, 5), maxAllowed);
}

export function quizDifficultyInstruction(difficulty: QuizDifficulty) {
  if (difficulty === "mixed") {
    return `"mixed" difficulty policy:
- Use approximately 30% easy, 40% medium, and 30% hard questions; the server assigns a difficulty to every slot.
- Apply the matching Easy, Medium, or Hard rubric below to each question individually.
- Never label a direct-recall question as Medium or Hard, and never invent a scenario unsupported by the source.`;
  }
  if (difficulty === "hard") {
    return `"hard" difficulty policy:
- 75-90% of questions MUST be application, situational, case-based, analysis, integration, or multi-step reasoning questions.
- Situations must still be answerable only from the uploaded material; do not add outside clinical facts or made-up context.
- Ask students to choose the best action, interpretation, relationship, likely effect, exception, or consequence from the source.
- Reject simple direct-recall questions labeled hard. The remaining 10-25% may test high-value concepts, but must still require discrimination between close source details.`;
  }
  if (difficulty === "medium") {
    return `"medium" difficulty policy:
- 50-60% of questions should be light application, short situational interpretation, comparison, or one-step cause/effect reasoning when the source supports it.
- The remaining questions should test conceptual understanding, relationships, classifications, and source-supported explanations.
- Avoid long multi-step scenarios in medium; save those for hard difficulty.
- Keep wording simpler than hard while still requiring understanding beyond direct recall.`;
  }
  return `"easy" difficulty policy:
- 85-95% of questions should be direct recall, definitions, identification, simple matching, or key-term recognition.
- Use very little application wording unless the source itself presents a direct example.
- Avoid multi-step, case-based, or trick scenario questions.`;
}
