/**
 * 7.12.6 – Verification Orchestrator Tests
 *
 * Tests that the VerificationOrchestrator makes the correct deterministic
 * decision about verification pass/fail. The model must NEVER be able to
 * assert "verified" — only this orchestrator can.
 *
 * Coverage:
 *   - No verification plan → always verified (calm path)
 *   - Failed tool → verification fails immediately
 *   - Math domain with no calc tool run → verification fails
 *   - Math domain with successful calc tool → verification passes
 *   - Physics domain with no unit_check → verification fails
 *   - Physics domain with successful unit_check + calc → verification passes
 *   - Physics domain with unit mismatch → verification fails
 *   - check_work with no recalculation → consistency failure
 *   - check_work with recalculation → consistency passes
 *   - Numerical equivalence: zero, tolerance, relative tolerance
 */

import { describe, test, expect } from 'vitest';
import { VerificationOrchestrator } from '../lib/ai/tutor/verification/orchestrator';
import { selectTutorStrategy } from '../lib/ai/tutor/strategy';
import type { TutorIntent, TutorPlan } from '../lib/ai/tutor/types';
import type { ToolExecutionResult } from '../lib/ai/tutor/tools/executor';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function intent(overrides: Partial<TutorIntent> = {}): TutorIntent {
  return {
    intent: 'explain',
    domain: 'general_academic',
    complexity: 'simple',
    requiresTool: false,
    requiresVerification: false,
    confidence: 0.9,
    ...overrides,
  };
}

function makePlan(overrides: Partial<TutorIntent> = {}): TutorPlan {
  return selectTutorStrategy(intent(overrides));
}

function toolOk(toolName: ToolExecutionResult['toolName'], result: any = { valid: true }): ToolExecutionResult {
  return { toolName, args: {}, result };
}

function toolErr(toolName: ToolExecutionResult['toolName'], error = 'Tool error'): ToolExecutionResult {
  return { toolName, args: {}, error };
}

// ─── No-verification plan ─────────────────────────────────────────────────────

describe('VerificationOrchestrator – no-verification plan', () => {
  test('returns verified=true when plan does not require verification', () => {
    const plan = makePlan({ intent: 'explain', complexity: 'simple', requiresVerification: false });
    // Ensure the plan actually skips verification
    expect(plan.requiresVerification).toBe(false);

    const orch = new VerificationOrchestrator(plan);
    const result = orch.verify([]);
    expect(result.verified).toBe(true);
    expect(result.issues).toHaveLength(0);
  });
});

// ─── Tool failure path ────────────────────────────────────────────────────────

describe('VerificationOrchestrator – failed tool blocks verification', () => {
  test('any tool error → verified=false immediately', () => {
    const plan = makePlan({
      intent: 'math_calculation',
      domain: 'mathematics',
      complexity: 'moderate',
      requiresTool: true,
      requiresVerification: true,
      confidence: 0.9,
    });
    const orch = new VerificationOrchestrator(plan);
    const result = orch.verify([toolErr('calculator', 'Syntax error in expression')]);
    expect(result.verified).toBe(false);
    expect(result.checks.calculation).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
  });
});

// ─── Mathematics verification ──────────────────────────────────────────────────

describe('VerificationOrchestrator – mathematics domain', () => {
  const mathPlan = makePlan({
    intent: 'math_calculation',
    domain: 'mathematics',
    complexity: 'moderate',
    requiresTool: true,
    requiresVerification: true,
    confidence: 0.9,
  });

  test('no calculator run → verification fails', () => {
    const orch = new VerificationOrchestrator(mathPlan);
    // Plan has tools but no tool was actually executed
    const result = orch.verify([]);
    // When tools.length > 0 but no calc was run, verification should fail
    if (mathPlan.tools.length > 0) {
      expect(result.verified).toBe(false);
      expect(result.checks.calculation).toBe(false);
    }
  });

  test('successful calculator run → calculation check passes', () => {
    const orch = new VerificationOrchestrator(mathPlan);
    const result = orch.verify([toolOk('calculator', '42')]);
    expect(result.checks.calculation).toBe(true);
    expect(result.verified).toBe(true);
  });

  test('successful code_execution run → calculation check passes', () => {
    const orch = new VerificationOrchestrator(mathPlan);
    const result = orch.verify([toolOk('code_execution', { output: '42' })]);
    expect(result.checks.calculation).toBe(true);
  });
});

// ─── Physics verification ──────────────────────────────────────────────────────

describe('VerificationOrchestrator – physics domain', () => {
  const physicsPlan = makePlan({
    intent: 'physics_problem',
    domain: 'physics',
    complexity: 'moderate',
    requiresTool: true,
    requiresVerification: true,
    confidence: 0.9,
  });

  test('no unit_check run → dimensionality check fails', () => {
    const orch = new VerificationOrchestrator(physicsPlan);
    // unit_check is in the plan but was never executed
    if (physicsPlan.tools.includes('unit_check')) {
      const result = orch.verify([toolOk('calculator', '9.8')]);
      // Without unit_check, the physics verification is incomplete
      expect(result.checks.dimensionality).toBe(false);
      expect(result.verified).toBe(false);
    }
  });

  test('successful unit_check + calculator → full verification passes', () => {
    const orch = new VerificationOrchestrator(physicsPlan);
    const result = orch.verify([
      toolOk('calculator', '196'),
      toolOk('unit_check', { valid: true, value: 196, unit: 'J' }),
    ]);
    expect(result.checks.dimensionality).toBe(true);
    expect(result.checks.units).toBe(true);
    expect(result.verified).toBe(true);
  });

  test('unit_check with invalid result → verified=false', () => {
    const orch = new VerificationOrchestrator(physicsPlan);
    const result = orch.verify([
      toolOk('calculator', '196'),
      toolOk('unit_check', { valid: false, reason: 'Dimensional mismatch' }),
    ]);
    expect(result.checks.dimensionality).toBe(false);
    expect(result.checks.units).toBe(false);
    expect(result.verified).toBe(false);
  });
});

// ─── check_work path ──────────────────────────────────────────────────────────

describe('VerificationOrchestrator – check_work intent', () => {
  const checkPlan = makePlan({
    intent: 'check_work',
    domain: 'mathematics',
    complexity: 'moderate',
    requiresTool: true,
    requiresVerification: true,
    confidence: 0.9,
  });

  test('no recalculation run → consistency fails', () => {
    const orch = new VerificationOrchestrator(checkPlan);
    const result = orch.verify([]);
    expect(result.checks.consistency).toBe(false);
    expect(result.verified).toBe(false);
  });

  test('successful recalculation → consistency passes', () => {
    const orch = new VerificationOrchestrator(checkPlan);
    const result = orch.verify([toolOk('calculator', '42')]);
    expect(result.checks.consistency).toBe(true);
  });
});

// ─── Numerical equivalence ────────────────────────────────────────────────────

describe('VerificationOrchestrator.verifyNumericalEquivalence', () => {
  const orch = new VerificationOrchestrator(makePlan());

  test('exact match returns true', () => {
    expect(orch.verifyNumericalEquivalence(42, 42)).toBe(true);
  });

  test('value within relative tolerance returns true', () => {
    // 1e-7 relative difference on 9.8 → within 1e-6 rel tol
    expect(orch.verifyNumericalEquivalence(9.8, 9.8000009)).toBe(true);
  });

  test('value outside relative tolerance returns false', () => {
    // 0.1 difference on 9.8 → clearly outside tolerance
    expect(orch.verifyNumericalEquivalence(9.8, 9.9)).toBe(false);
  });

  test('zero expected: uses absolute tolerance', () => {
    expect(orch.verifyNumericalEquivalence(0, 1e-10)).toBe(true);  // within 1e-9 absTol
    expect(orch.verifyNumericalEquivalence(0, 1e-8)).toBe(false);  // outside absTol
  });

  test('negative values work symmetrically', () => {
    expect(orch.verifyNumericalEquivalence(-5, -5)).toBe(true);
    expect(orch.verifyNumericalEquivalence(-5, -4)).toBe(false);
  });

  test('custom tolerances are respected', () => {
    // With a wide absTol of 1.0, a difference of 0.5 passes
    expect(orch.verifyNumericalEquivalence(10, 10.5, 1.0, 0)).toBe(true);
    // With a strict absTol of 0.01 and relTol 0, a difference of 0.5 fails
    expect(orch.verifyNumericalEquivalence(10, 10.5, 0.01, 0)).toBe(false);
  });

  test('large values use relative tolerance, not absolute', () => {
    // 1e12 ± 1000 → relative error = 1e-9, within 1e-6 relTol
    expect(orch.verifyNumericalEquivalence(1e12, 1e12 + 1000)).toBe(true);
    // 1e12 ± 1e7 → relative error = 1e-5, outside 1e-6 relTol
    expect(orch.verifyNumericalEquivalence(1e12, 1e12 + 1e7)).toBe(false);
  });
});
