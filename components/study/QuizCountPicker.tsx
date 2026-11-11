const FREE_QUIZ_COUNTS = [5, 10, 15, 20, 25, 30] as const;
const PREMIUM_QUIZ_COUNTS = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50] as const;

export type QuizCount = (typeof PREMIUM_QUIZ_COUNTS)[number];

export function quizCountOptions(isPremium: boolean) {
  return isPremium ? [...PREMIUM_QUIZ_COUNTS] : [...FREE_QUIZ_COUNTS];
}

export default function QuizCountPicker({
  value,
  isPremium,
  onChange,
}: {
  value: QuizCount;
  isPremium: boolean;
  onChange: (value: QuizCount) => void;
}) {
  const min = 5;
  const max = isPremium ? 50 : 30;
  const optionLabels = quizCountOptions(isPremium);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-sm font-black text-slate-900 dark:text-white">How many quiz questions?</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Move the line to choose. Free accounts stop at 30; Premium can reach 50.
          </p>
        </div>
        <span className="rounded-full bg-indigo-100 px-3 py-1 text-sm font-black text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-200">
          {value} questions
        </span>
      </div>
      <div className="mt-5">
        <input
          type="range"
          aria-label="Quiz question count"
          min={min}
          max={max}
          step={5}
          value={Math.min(value, max)}
          onChange={(event) => onChange(Number(event.target.value) as QuizCount)}
          className="h-3 w-full cursor-pointer appearance-none rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 accent-indigo-600 outline-none transition focus:ring-4 focus:ring-indigo-500/20 dark:from-indigo-400 dark:via-violet-400 dark:to-fuchsia-400"
        />
        <div className="mt-2 flex justify-between text-[11px] font-black text-slate-400">
          {optionLabels.map((count) => <span key={count}>{count}</span>)}
        </div>
      </div>
      {!isPremium && <p className="mt-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Unlock Premium to move beyond 30 questions.</p>}
    </div>
  );
}
