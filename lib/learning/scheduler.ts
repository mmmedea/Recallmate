import { fsrs, Card, generatorParameters, Rating, State } from "ts-fsrs";

// Initialize FSRS with default standard parameters (no personalization for MVP)
const fsrsParams = generatorParameters({ enable_fuzz: true });
const f = fsrs(fsrsParams);

export type FSRSRating = 1 | 2 | 3 | 4;

export const FSRSRatings = {
  Again: Rating.Again as FSRSRating,
  Hard: Rating.Hard as FSRSRating,
  Good: Rating.Good as FSRSRating,
  Easy: Rating.Easy as FSRSRating,
};

// Medea internal state representation (matches the DB schema exactly)
export interface LearningItemState {
  state: number; // 0=New, 1=Learning, 2=Review, 3=Relearning
  due_at: Date;
  stability: number;
  difficulty: number;
  reps: number;
  lapses: number;
  last_reviewed_at: Date | null;
}

export function getNextLearningState(
  currentState: LearningItemState,
  rating: FSRSRating,
  now: Date = new Date()
): { newState: LearningItemState; scheduledDays: number } {
  // 1. Reconstruct the ts-fsrs Card object from our internal state
  const card: Card = {
    due: currentState.due_at,
    stability: currentState.stability,
    difficulty: currentState.difficulty,
    elapsed_days: currentState.last_reviewed_at
      ? Math.floor((now.getTime() - currentState.last_reviewed_at.getTime()) / (1000 * 60 * 60 * 24))
      : 0,
    scheduled_days: 0, // This gets calculated inside FSRS
    learning_steps: 0,
    reps: currentState.reps,
    lapses: currentState.lapses,
    state: currentState.state as State,
    last_review: currentState.last_reviewed_at || undefined,
  };

  // 2. Schedule the next review
  // ts-fsrs returns a collection of records for all possible ratings. We pick the one the user chose.
  const schedulingCards = f.repeat(card, now);
  
  // `rating` matches 1 (Again), 2 (Hard), 3 (Good), 4 (Easy)
  const record = schedulingCards[rating];
  
  if (!record) {
    throw new Error(`Invalid FSRS rating provided: ${rating}`);
  }

  // 3. Extract the scheduled days to return to the caller for the ledger
  const nextCard = record.card;
  const scheduledDays = nextCard.scheduled_days;

  // 4. Return our updated internal state format
  return {
    newState: {
      state: nextCard.state as number,
      due_at: nextCard.due,
      stability: nextCard.stability,
      difficulty: nextCard.difficulty,
      reps: nextCard.reps,
      lapses: nextCard.lapses,
      last_reviewed_at: now,
    },
    scheduledDays
  };
}
