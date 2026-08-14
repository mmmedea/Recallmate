import { TutorPlan, TutorToolName } from "../types";
import { executeCalculator } from "./calculator";
import { executeUnitCheck } from "./unit-check";
import { getToolDefinition } from "./registry";
import { ToolLimits } from "./limits";

export type ToolExecutionResult = {
  toolName: TutorToolName;
  args: any;
  result?: any;
  error?: string;
};

export class ToolExecutor {
  private callCount = 0;

  constructor(private plan: TutorPlan) {}

  public execute(toolName: string, args: any): ToolExecutionResult {
    // 1. Enforce Tool Chaining limits
    if (this.callCount >= ToolLimits.MAX_TOOL_CALLS_PER_INTERACTION) {
      return { toolName: toolName as TutorToolName, args, error: "Exceeded maximum tool calls per interaction." };
    }
    this.callCount++;

    // 2. Validate against TutorPlan
    if (!this.plan.tools.includes(toolName as TutorToolName)) {
      return { toolName: toolName as TutorToolName, args, error: `Tool ${toolName} is not permitted by the current Tutor Plan.` };
    }

    const definition = getToolDefinition(toolName as TutorToolName);
    if (!definition) {
      return { toolName: toolName as TutorToolName, args, error: `Tool ${toolName} is not found in the registry.` };
    }

    // 3. Schema validation
    if (definition.schema) {
      const parsed = definition.schema.safeParse(args);
      if (!parsed.success) {
        return { toolName: toolName as TutorToolName, args, error: `Invalid arguments for ${toolName}: ${parsed.error.message}` };
      }
      args = parsed.data; // use strongly typed/coerced data
    }

    // 4. Execution
    try {
      switch (toolName as TutorToolName) {
        case "calculator":
          const calcResult = executeCalculator(args);
          return { toolName: "calculator", args, result: calcResult.valid ? calcResult.result : undefined, error: calcResult.error };
        
        case "unit_check":
          const unitResult = executeUnitCheck(args);
          return { toolName: "unit_check", args, result: unitResult.valid ? unitResult : undefined, error: unitResult.reason };
        
        case "code_execution":
        case "symbolic_math":
          // The native Gemini Code Execution runs in the provider layer via `tools: [{codeExecution: {}}]`.
          // We don't execute it locally here unless we are mocking it.
          // The executor acts as an orchestrator, but in actual streaming, the Gemini API handles this execution directly.
          return { toolName: toolName as TutorToolName, args, error: "Native Code Execution must be executed by the provider environment." };

        default:
          return { toolName: toolName as TutorToolName, args, error: `Tool executor not implemented for ${toolName}.` };
      }
    } catch (e: any) {
      return { toolName: toolName as TutorToolName, args, error: `Execution failed: ${e.message}` };
    }
  }
}
