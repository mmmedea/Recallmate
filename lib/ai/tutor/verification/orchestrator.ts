import { TutorPlan, TutorIntent } from "../types";
import { ToolExecutionResult } from "../tools/executor";

export type VerificationResult = {
  verified: boolean;
  checks: {
    calculation?: boolean;
    symbolic?: boolean;
    units?: boolean;
    dimensionality?: boolean;
    grounding?: boolean;
    consistency?: boolean;
    completeness?: boolean;
  };
  issues: string[];
  correctedResult?: string;
};

export class VerificationOrchestrator {
  constructor(private plan: TutorPlan) {}

  public verify(toolResults: ToolExecutionResult[]): VerificationResult {
    // If no verification is needed by the plan (e.g. simple explanation), default to verified.
    if (!this.plan.requiresVerification) {
      return { verified: true, checks: {}, issues: [] };
    }

    const issues: string[] = [];
    const checks: any = {};

    // Check 1: Tool Executions
    const failedTools = toolResults.filter(r => r.error);
    if (failedTools.length > 0) {
      issues.push(`Tool execution failed for: ${failedTools.map(t => t.toolName).join(', ')}`);
      return { verified: false, checks: { calculation: false }, issues };
    }

    // Mathematical verification (Calculation/Symbolic)
    if (this.plan.domain === "mathematics" || this.plan.intent === "math_calculation") {
      const calcResults = toolResults.filter(r => r.toolName === "calculator" || r.toolName === "symbolic_math" || r.toolName === "code_execution");
      if (calcResults.length === 0 && this.plan.tools.length > 0) {
        issues.push("Mathematical verification required but no calculation tool was successfully run.");
        checks.calculation = false;
      } else {
        checks.calculation = true;
      }
    }

    // Physics/Chemistry verification (Units + Dimensions)
    if (this.plan.domain === "physics" || this.plan.domain === "chemistry") {
      const unitResults = toolResults.filter(r => r.toolName === "unit_check");
      if (this.plan.tools.includes("unit_check") && unitResults.length === 0) {
        issues.push("Dimensional/Unit verification required but no unit check was run.");
        checks.dimensionality = false;
      } else if (unitResults.some(r => !r.result?.valid)) {
        issues.push("Dimensional inconsistency detected. Units do not correctly resolve or match expected bounds.");
        checks.dimensionality = false;
        checks.units = false;
      } else {
        checks.dimensionality = true;
        checks.units = true;
        // In physics/chem we usually expect calculations too
        checks.calculation = true;
      }
    }

    // Check my work special path
    if (this.plan.intent === "check_work") {
      const execResults = toolResults.filter(r => r.toolName === "code_execution" || r.toolName === "calculator");
      if (execResults.length === 0) {
        issues.push("Independent recalculation is required for check_work intent.");
        checks.consistency = false;
      } else {
        checks.consistency = true;
      }
    }

    const isVerified = issues.length === 0;

    return {
      verified: isVerified,
      checks,
      issues
    };
  }

  /**
   * Evaluates numerical equivalence between expected and computed values.
   * Handles relative and absolute tolerance logic with explicit zero handling.
   * Baseline defaults: absTol = 1e-9, relTol = 1e-6.
   */
  public verifyNumericalEquivalence(
    expected: number,
    computed: number,
    absTol: number = 1e-9,
    relTol: number = 1e-6
  ): boolean {
    const diff = Math.abs(computed - expected);
    if (expected === 0) {
       return diff <= absTol;
    }
    return diff <= Math.max(absTol, relTol * Math.abs(expected));
  }
}
