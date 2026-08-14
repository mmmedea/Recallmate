import { z } from "zod";

export const CalculatorSchema = z.object({
  expression: z.string().describe("A mathematical expression to evaluate, using +, -, *, /, (), ^.")
});

export const SymbolicMathSchema = z.object({
  operation: z.enum(["simplify", "solve", "differentiate", "integrate", "factor"]).describe("The symbolic operation to perform."),
  expression: z.string().describe("The mathematical expression or equation."),
  variable: z.string().optional().describe("The variable to solve or integrate/differentiate with respect to, if applicable.")
});

export const UnitCheckSchema = z.object({
  value: z.number().describe("The numerical value to convert."),
  fromUnit: z.string().describe("The source unit symbol (e.g. m/s, kg, J)."),
  toUnit: z.string().describe("The target unit symbol.")
});

export const CodeExecutionSchema = z.object({
  // Native code execution has its own schema in the Gemini API, 
  // but we provide this for symmetry in our registry if we ever need to manually mock/wrap it.
  code: z.string().describe("Python code to execute.")
});
