import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { detectTutorIntent } from "./lib/ai/tutor/intent";
import { selectTutorStrategy } from "./lib/ai/tutor/strategy";

async function runTests() {
  const tests = [
    { name: "Math", msg: "Solve the integral of x^2 from 0 to 3." },
    { name: "Physics", msg: "A car accelerates at 5 m/s^2 for 10 seconds. What is its final velocity?" },
    { name: "Chemistry", msg: "Calculate the moles of NaCl in 50g of salt." },
    { name: "Programming", msg: "Why is my React useEffect running twice?" },
    { name: "Conceptual", msg: "Explain the difference between mitosis and meiosis." },
    { name: "Hint", msg: "I'm stuck on this algebra problem. Can you give me a hint on what to do next?" },
    { name: "Socratic", msg: "Don't just give me the answer. Help me solve it step by step." },
    { name: "Check Work", msg: "I got v = 12.4 m/s. Is that correct?" },
    { name: "Simplify", msg: "Explain quantum entanglement like I'm 5 years old." }
  ];

  for (const t of tests) {
    console.log(`\n=== Testing: ${t.name} ===`);
    console.log(`User Message: "${t.msg}"`);
    try {
      const intent = await detectTutorIntent(t.msg);
      const strategy = selectTutorStrategy(intent);
      console.log(`Intent: ${intent.intent} | Domain: ${intent.domain} | Complexity: ${intent.complexity}`);
      console.log(`Reasoning: ${strategy.reasoningLevel} | Tools: ${strategy.tools.join(", ")}`);
      console.log(`Prompt Snippet: ${strategy.systemPrompt.split('\n').filter((l: string) => l.startsWith('###')).join(' ')}`);
      await new Promise(resolve => setTimeout(resolve, 15000));
    } catch (e: any) {
      console.error(`Error: ${e.message}`);
    }
  }
}

runTests();
