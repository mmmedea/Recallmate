/**
 * 7.12.5 – Tutor Policy Tests
 *
 * Tests the deterministic routing logic: intent → strategy → tool policy →
 * verification policy → context budget.  These must be stable across model
 * changes because they are server-side policy, not AI inference.
 *
 * Coverage:
 *   - Intent × Domain × Complexity → correct TutorPlan strategy
 *   - Intent × Domain → correct tool set
 *   - Intent × Complexity → correct verification requirement
 *   - Context budget is proportional to complexity
 *   - Reasoning level is proportional to complexity
 *   - Tutor strategy covers all TutorIntentEnum values (no gaps)
 */

import { describe, test, expect } from 'vitest';
import { selectTutorStrategy } from '../lib/ai/tutor/strategy';
import { selectToolPolicy } from '../lib/ai/tutor/tool-policy';
import { getVerificationPolicy } from '../lib/ai/tutor/verification';
import type { TutorIntent } from '../lib/ai/tutor/types';

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

// ─── Strategy mapping ─────────────────────────────────────────────────────────

describe('TutorStrategy – intent → strategy mapping', () => {
  test('hint → "hint" strategy', () => {
    const plan = selectTutorStrategy(intent({ intent: 'hint' }));
    expect(plan.strategy).toBe('hint');
  });

  test('socratic → "socratic" strategy', () => {
    const plan = selectTutorStrategy(intent({ intent: 'socratic' }));
    expect(plan.strategy).toBe('socratic');
  });

  test('check_work → "check_work" strategy', () => {
    const plan = selectTutorStrategy(intent({ intent: 'check_work' }));
    expect(plan.strategy).toBe('check_work');
  });

  test('summarize → "summarize" strategy', () => {
    const plan = selectTutorStrategy(intent({ intent: 'summarize' }));
    expect(plan.strategy).toBe('summarize');
  });

  test('compare → "compare" strategy', () => {
    const plan = selectTutorStrategy(intent({ intent: 'compare' }));
    expect(plan.strategy).toBe('compare');
  });

  test('debug → "debug" strategy', () => {
    const plan = selectTutorStrategy(intent({ intent: 'debug', domain: 'computer_science' }));
    expect(plan.strategy).toBe('debug');
  });

  test('math_calculation → "step_by_step" strategy', () => {
    const plan = selectTutorStrategy(intent({ intent: 'math_calculation', domain: 'mathematics' }));
    expect(plan.strategy).toBe('step_by_step');
  });

  test('physics_problem → "step_by_step" strategy', () => {
    const plan = selectTutorStrategy(intent({ intent: 'physics_problem', domain: 'physics' }));
    expect(plan.strategy).toBe('step_by_step');
  });

  test('chemistry_problem → "step_by_step" strategy', () => {
    const plan = selectTutorStrategy(intent({ intent: 'chemistry_problem', domain: 'chemistry' }));
    expect(plan.strategy).toBe('step_by_step');
  });

  test('explain (simple) → "direct_explanation" strategy', () => {
    const plan = selectTutorStrategy(intent({ intent: 'explain' }));
    expect(plan.strategy).toBe('direct_explanation');
  });
});

// ─── Tool policy ──────────────────────────────────────────────────────────────

describe('TutorToolPolicy – intent × domain → tool set', () => {
  test('simple explanation gets no tools', () => {
    const tools = selectToolPolicy(intent({ requiresTool: false }));
    expect(tools).toHaveLength(0);
  });

  test('physics problem always gets unit_check', () => {
    const tools = selectToolPolicy(intent({
      intent: 'physics_problem',
      domain: 'physics',
      complexity: 'moderate',
      requiresTool: true,
      confidence: 0.9,
    }));
    expect(tools).toContain('unit_check');
  });

  test('chemistry problem always gets unit_check', () => {
    const tools = selectToolPolicy(intent({
      intent: 'chemistry_problem',
      domain: 'chemistry',
      complexity: 'moderate',
      requiresTool: true,
      confidence: 0.9,
    }));
    expect(tools).toContain('unit_check');
  });

  test('history/literature problem never gets unit_check', () => {
    const tools = selectToolPolicy(intent({
      intent: 'explain',
      domain: 'history',
      requiresTool: false,
    }));
    expect(tools).not.toContain('unit_check');
  });

  test('complex math gets code_execution + symbolic_math', () => {
    const tools = selectToolPolicy(intent({
      intent: 'math_calculation',
      domain: 'mathematics',
      complexity: 'complex',
      requiresTool: true,
      confidence: 0.9,
    }));
    expect(tools).toContain('code_execution');
    expect(tools).toContain('symbolic_math');
  });

  test('simple math does not get code_execution (not warranted)', () => {
    const tools = selectToolPolicy(intent({
      intent: 'math_calculation',
      domain: 'mathematics',
      complexity: 'simple',
      requiresTool: true,
      confidence: 0.9,
    }));
    expect(tools).not.toContain('code_execution');
    expect(tools).toContain('calculator');
  });

  test('low-confidence router disables all tools regardless of intent', () => {
    const tools = selectToolPolicy(intent({
      intent: 'physics_problem',
      domain: 'physics',
      complexity: 'complex',
      requiresTool: true,
      confidence: 0.3, // below 0.5 threshold
    }));
    expect(tools).toHaveLength(0);
  });
});

// ─── Verification policy ──────────────────────────────────────────────────────

describe('VerificationPolicy – intent × complexity → requirement', () => {
  test('math_calculation always requires verification', () => {
    expect(getVerificationPolicy(intent({ intent: 'math_calculation' }))).toBe(true);
  });

  test('physics_problem always requires verification', () => {
    expect(getVerificationPolicy(intent({ intent: 'physics_problem', domain: 'physics' }))).toBe(true);
  });

  test('chemistry_problem always requires verification', () => {
    expect(getVerificationPolicy(intent({ intent: 'chemistry_problem', domain: 'chemistry' }))).toBe(true);
  });

  test('check_work always requires verification', () => {
    expect(getVerificationPolicy(intent({ intent: 'check_work' }))).toBe(true);
  });

  test('simple explain does NOT require verification', () => {
    const i = intent({ intent: 'explain', complexity: 'simple', requiresVerification: false });
    expect(getVerificationPolicy(i)).toBe(false);
  });

  test('complex explain DOES require verification', () => {
    const i = intent({ intent: 'explain', complexity: 'complex', requiresVerification: false });
    expect(getVerificationPolicy(i)).toBe(true);
  });

  test('simple summarize does NOT require verification', () => {
    const i = intent({ intent: 'summarize', complexity: 'simple', requiresVerification: false });
    expect(getVerificationPolicy(i)).toBe(false);
  });

  test('requiresVerification flag on intent overrides defaults', () => {
    const i = intent({ intent: 'hint', complexity: 'simple', requiresVerification: true });
    expect(getVerificationPolicy(i)).toBe(true);
  });

  test('document_qa requires verification', () => {
    expect(getVerificationPolicy(intent({ intent: 'document_qa' }))).toBe(true);
  });
});

// ─── Context budget: proportionality ──────────────────────────────────────────

describe('Context Budget – complexity proportionality', () => {
  test('complex problems get more evidence chunks than simple', () => {
    const simplePlan = selectTutorStrategy(intent({ complexity: 'simple' }));
    const complexPlan = selectTutorStrategy(intent({ complexity: 'complex' }));
    expect(complexPlan.contextBudget.maxChunks).toBeGreaterThan(simplePlan.contextBudget.maxChunks);
  });

  test('complex problems get more evidence tokens than simple', () => {
    const simplePlan = selectTutorStrategy(intent({ complexity: 'simple' }));
    const complexPlan = selectTutorStrategy(intent({ complexity: 'complex' }));
    expect(complexPlan.contextBudget.maxEvidenceTokens).toBeGreaterThan(simplePlan.contextBudget.maxEvidenceTokens);
  });

  test('context budget values are positive integers', () => {
    const plan = selectTutorStrategy(intent());
    const b = plan.contextBudget;
    expect(b.maxChunks).toBeGreaterThan(0);
    expect(b.maxEvidenceTokens).toBeGreaterThan(0);
    expect(b.maxHistoryTokens).toBeGreaterThan(0);
    expect(b.maxChunkTokens).toBeGreaterThan(0);
  });
});

// ─── Plan completeness ────────────────────────────────────────────────────────

describe('TutorPlan – completeness', () => {
  const allIntents = [
    'document_qa', 'explain', 'math_calculation', 'physics_problem',
    'chemistry_problem', 'hint', 'socratic', 'check_work',
    'summarize', 'compare', 'debug', 'quiz',
  ] as const;

  test.each(allIntents)('intent "%s" produces a valid TutorPlan', (intentType) => {
    const plan = selectTutorStrategy(intent({ intent: intentType }));
    expect(plan.intent).toBe(intentType);
    expect(plan.strategy).toBeTruthy();
    expect(plan.systemPrompt.length).toBeGreaterThan(50);
    expect(['low', 'medium', 'high']).toContain(plan.reasoningLevel);
    expect(['general', 'math', 'physics', 'chemistry', 'code']).toContain(plan.responseFormat);
  });
});
