import { LearningItemState } from "./scheduler.js";

export interface DocumentLearningStats {
  totalItems: number;
  newItems: number;
  dueToday: number;
  overdue: number;
  stable: number; // Items that aren't due today
  masteryPercentage: number;
}

export function calculateDocumentMastery(
  items: LearningItemState[],
  now: Date = new Date()
): DocumentLearningStats {
  if (!items || items.length === 0) {
    return {
      totalItems: 0,
      newItems: 0,
      dueToday: 0,
      overdue: 0,
      stable: 0,
      masteryPercentage: 0,
    };
  }

  let newItems = 0;
  let dueToday = 0;
  let overdue = 0;
  let stable = 0;
  
  let totalRetrievability = 0;

  for (const item of items) {
    // 0 = New, 1 = Learning, 2 = Review, 3 = Relearning
    if (item.state === 0) {
      newItems++;
      continue;
    }

    const isDue = item.due_at <= now;
    
    // Simplistic overdue check: if it was due more than 24h ago
    const msOverdue = now.getTime() - item.due_at.getTime();
    if (isDue && msOverdue > 24 * 60 * 60 * 1000) {
      overdue++;
    } else if (isDue) {
      dueToday++;
    } else {
      stable++;
    }

    // FSRS Retrievability approximation: 
    // R = Math.exp(Math.log(0.9) * elapsed_days / stability)
    // If it's never been reviewed, elapsed is 0, so R=1 (but it's New, which we skipped)
    let elapsedDays = 0;
    if (item.last_reviewed_at) {
      elapsedDays = Math.max(0, (now.getTime() - item.last_reviewed_at.getTime()) / (1000 * 60 * 60 * 24));
    }
    
    let r = 0;
    if (item.stability > 0) {
      r = Math.exp(Math.log(0.9) * elapsedDays / item.stability);
    }
    
    totalRetrievability += r;
  }

  // Mastery is the average retrievability of all NON-NEW items.
  const activeItems = items.length - newItems;
  let masteryPercentage = 0;
  
  if (activeItems > 0) {
    masteryPercentage = Math.round((totalRetrievability / activeItems) * 100);
  }

  return {
    totalItems: items.length,
    newItems,
    dueToday,
    overdue,
    stable,
    masteryPercentage,
  };
}
