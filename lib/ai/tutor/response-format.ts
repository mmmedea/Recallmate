import { TutorIntent, ResponseFormat } from "./types";

export function selectResponseFormat(intent: TutorIntent): { formatName: ResponseFormat, formattingRules: string } {
  let formatRules = "";
  let formatName: ResponseFormat = "general";

  // 1. Domain-specific formatting
  switch (intent.domain) {
    case "mathematics":
      formatName = "math";
      formatRules += `### Mathematical Formatting Rules
Use the following structure:
### Given
...
### Find
...
### Approach
...
### Solve
...
### Verify
...
### Answer
...
`;
      break;
    case "physics":
      formatName = "physics";
      formatRules += `### Physics Formatting Rules
Use the following structure:
### Known
...
### Unknown
...
### Principle
...
### Equation
...
### Substitute
...
### Units Check
...
### Answer
...
`;
      break;
    case "chemistry":
      formatName = "chemistry";
      formatRules += `### Chemistry Formatting Rules
Use the following structure:
### Given
...
### Reaction
...
### Mole Relationship
...
### Calculation
...
### Check
...
### Answer
...
`;
      break;
    case "computer_science":
    case "engineering":
      formatName = "code";
      formatRules += `### Programming/Engineering Formatting Rules
Use the following structure:
### What is happening
...
### Approach
...
### Code/Solution
...
### Why it works
...
### Edge cases
...
`;
      break;
    default:
      formatName = "general";
      formatRules += `### General Formatting Rules
Prefer 2-4 sentence paragraphs.
Avoid walls of text.
Use headings when the topic changes.
Use numbered steps for procedures.
Use bullets for lists.
Put equations on separate lines using LaTeX.
End with a concise takeaway when helpful.
`;
      break;
  }

  // 2. Intent-specific behavioral modifiers
  switch (intent.intent) {
    case "explain":
      formatRules += `\n**Direct Explanation Focus**: Start with the core idea, explain how it works, give an example, and state the key takeaway.`;
      break;
    case "hint":
      formatRules += `\n**Hint Focus**: GIVE ONLY THE NEXT USEFUL STEP. Do NOT give the solution.`;
      break;
    case "socratic":
      formatRules += `\n**Socratic Focus**: Do not give the answer. Ask targeted questions and reveal the solution progressively.`;
      break;
    case "compare":
      formatRules += `\n**Comparison Focus**: Use a structured comparison (e.g. a markdown table or clear contrasted lists).`;
      break;
    case "check_work":
      formatRules += `\n**Check Work Focus**: 1. Identify the student's result. 2. Reconstruct the relevant calculation. 3. Find the first divergence. 4. Explain the error. 5. Give the corrected result. If correct, explicitly confirm their setup and units.`;
      break;
  }

  return { formatName, formattingRules: formatRules };
}
