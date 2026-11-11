import { z } from "zod";
import { CalculatorSchema } from "./schemas";
import * as math from "mathjs";

type CalculatorArgs = z.infer<typeof CalculatorSchema>;

export type CalculatorResult = {
  valid: boolean;
  result?: number | string;
  error?: string;
};

// Explicit AST Node allowlist for maximum safety.
// Rejects Assignment, FunctionAssignment, Accessor, Import, Block, Range, Object, etc.
const ALLOWED_NODE_TYPES = [
  "ConstantNode",
  "SymbolNode",
  "OperatorNode",
  "FunctionNode",
  "ParenthesisNode",
  "ArrayNode"
];

// Explicit function allowlist to prevent prototype pollution or unexpected math.js functions
const ALLOWED_FUNCTIONS = new Set([
  "sqrt", "abs", "sin", "cos", "tan", "log", "log10", "exp", "pow",
  "asin", "acos", "atan", "sinh", "cosh", "tanh",
  "mean", "median", "sum", "min", "max",
  "factorial"
]);

export function executeCalculator(args: CalculatorArgs): CalculatorResult {
  try {
    const node = math.parse(args.expression);
    let isSafe = true;
    let violation = "";

    // Pass 1: Collect all function names referenced in FunctionNodes.
    // In mathjs, FunctionNode's fn is a SymbolNode for the function name.
    // We must NOT flag these as "variable symbols" in pass 2.
    const functionNameSymbols = new Set<string>();
    node.traverse((n: any) => {
      if (n.type === "FunctionNode") {
        functionNameSymbols.add(n.fn.name);
      }
    });

    // Pass 2: Full safety check
    node.traverse((n: any) => {
      if (!isSafe) return; // short-circuit once a violation is found

      if (!ALLOWED_NODE_TYPES.includes(n.type)) {
        isSafe = false;
        violation = `Node type '${n.type}' is not permitted.`;
        return;
      }

      if (n.type === "FunctionNode") {
        if (!ALLOWED_FUNCTIONS.has(n.fn.name)) {
          isSafe = false;
          violation = `Function '${n.fn.name}' is not permitted.`;
        }
      }

      if (n.type === "SymbolNode") {
        // Function names appear as SymbolNodes — skip them (validated above).
        // Only check symbols that are stand-alone variable references.
        if (!functionNameSymbols.has(n.name)) {
          const allowedSymbols = ["pi", "e", "phi", "i"];
          if (!allowedSymbols.includes(n.name)) {
            isSafe = false;
            violation = `Symbol '${n.name}' is not permitted. Variables are not allowed.`;
          }
        }
      }
    });

    if (!isSafe) {
      return { valid: false, error: `Security violation in expression: ${violation}` };
    }

    const result = node.evaluate();

    if (typeof result === 'function') {
      return { valid: false, error: "Expression returned a function, expected a value." };
    }

    return {
      valid: true,
      result: result.toString()
    };
  } catch (err: any) {
    return {
      valid: false,
      error: `Failed to evaluate expression: ${err.message}`
    };
  }
}
