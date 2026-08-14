import { TutorToolName } from "../types";
import { CalculatorSchema, SymbolicMathSchema, UnitCheckSchema, CodeExecutionSchema } from "./schemas";
import { z } from "zod";

export type ToolDefinition = {
  name: TutorToolName;
  description: string;
  schema?: z.ZodTypeAny; // Zod schema for function calling parameters
  isNativeCodeExecution?: boolean; // True if this uses Gemini's native code execution
};

export const TutorToolRegistry: Record<TutorToolName, ToolDefinition> = {
  calculator: {
    name: "calculator",
    description: "Evaluates simple arithmetic expressions securely. Use for basic math like 25 * 48 or 1250 / 3.2.",
    schema: CalculatorSchema
  },
  symbolic_math: {
    name: "symbolic_math",
    description: "Performs symbolic math operations like simplify, solve, differentiate, integrate, and factor. Use native code execution under the hood.",
    isNativeCodeExecution: true, // We route symbolic_math to native code execution
    schema: SymbolicMathSchema
  },
  unit_check: {
    name: "unit_check",
    description: "Converts units and verifies dimensional consistency for physics and chemistry problems.",
    schema: UnitCheckSchema
  },
  code_execution: {
    name: "code_execution",
    description: "Gemini native Python code execution environment for complex math, numerical science, and algorithm execution.",
    isNativeCodeExecution: true
  }
};

export function getToolDefinition(name: TutorToolName): ToolDefinition {
  return TutorToolRegistry[name];
}
