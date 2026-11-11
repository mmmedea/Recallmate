import type { QuizDifficulty, QuizPlanSlot, QuizQuestionFormat, QuizQuestionType } from "./schema";

function allocate(count: number, weights: Array<[string, number]>) {
  const raw = weights.map(([key, weight]) => ({ key, exact: count * weight, amount: Math.floor(count * weight) }));
  let remaining = count - raw.reduce((sum, row) => sum + row.amount, 0);
  raw.sort((left, right) => (right.exact - right.amount) - (left.exact - left.amount));
  for (let i = 0; i < remaining; i += 1) raw[i % raw.length].amount += 1;
  return raw;
}

function spread<T extends string>(count: number, quotas: Array<{ key: T; amount: number }>): T[] {
  const rows = quotas.flatMap(({ key, amount }) =>
    Array.from({ length: amount }, (_, index) => ({ key, position: (index + 1) / amount })),
  );
  return rows.sort((a, b) => a.position - b.position).slice(0, count).map((row) => row.key);
}

export function planQuiz(count: number, difficulty: QuizDifficulty, format: QuizQuestionFormat): QuizPlanSlot[] {
  const safeCount = Math.max(1, Math.min(50, Math.floor(count)));
  const difficultyChoices = difficulty === "mixed"
    ? spread(safeCount, allocate(safeCount, [["easy", 0.3], ["medium", 0.4], ["hard", 0.3]]) as Array<{ key: QuizDifficulty; amount: number }>)
    : Array.from({ length: safeCount }, () => difficulty);
  const formats: QuizQuestionType[] = format === "mixed"
    ? spread(safeCount, allocate(safeCount, [["multiple_choice", 0.6], ["identification", 0.4]]) as Array<{ key: QuizQuestionType; amount: number }>)
    : Array.from({ length: safeCount }, () => format);

  return difficultyChoices.map((level, index) => ({
    index,
    difficulty: level as Exclude<QuizDifficulty, "mixed">,
    type: formats[index],
  }));
}
