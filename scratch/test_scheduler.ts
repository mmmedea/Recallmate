import { getNextLearningState, FSRSRatings, LearningItemState } from "../lib/learning/scheduler.js";

async function runTests() {
  console.log("Testing FSRS Scheduler Wrapper...\n");

  const initialState: LearningItemState = {
    state: 0, // New
    due_at: new Date(),
    stability: 0,
    difficulty: 0,
    reps: 0,
    lapses: 0,
    last_reviewed_at: null
  };

  const now = new Date();

  const againRes = getNextLearningState(initialState, FSRSRatings.Again, now);
  const hardRes = getNextLearningState(initialState, FSRSRatings.Hard, now);
  const goodRes = getNextLearningState(initialState, FSRSRatings.Good, now);
  const easyRes = getNextLearningState(initialState, FSRSRatings.Easy, now);

  console.log(`Again next due: ${againRes.newState.due_at}`);
  console.log(`Hard next due:  ${hardRes.newState.due_at}`);
  console.log(`Good next due:  ${goodRes.newState.due_at}`);
  console.log(`Easy next due:  ${easyRes.newState.due_at}`);
  
  // Interval relationship assertions
  const intervals = {
    Again: againRes.newState.due_at.getTime(),
    Hard: hardRes.newState.due_at.getTime(),
    Good: goodRes.newState.due_at.getTime(),
    Easy: easyRes.newState.due_at.getTime(),
  };

  if (intervals.Again < intervals.Hard && intervals.Hard < intervals.Good && intervals.Good < intervals.Easy) {
    console.log("\n✅ SUCCESS: Again < Hard < Good < Easy interval relationship holds.");
  } else {
    console.log("\n❌ ERROR: Interval relationship violated!");
    process.exit(1);
  }
}

runTests().catch(console.error);
