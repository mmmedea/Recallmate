/**
 * scratch/7.12-baseline.ts
 *
 * Medea Baseline Lock — NOT part of CI.
 *
 * Records the current Medea architecture version fingerprint to a
 * baseline file. Future changes must show a delta against this baseline.
 *
 * Usage:
 *   npx tsx scratch/7.12-baseline.ts
 *
 * Output:
 *   scratch/7.12-baseline-lock.json
 */

import * as fs from 'fs';
import * as path from 'path';
import { ModelRegistry } from '../lib/ai/config';
import { ToolLimits } from '../lib/ai/tutor/tools/limits';
import { selectTutorStrategy } from '../lib/ai/tutor/strategy';
import { selectToolPolicy } from '../lib/ai/tutor/tool-policy';
import { getVerificationPolicy } from '../lib/ai/tutor/verification';
import type { TutorIntent } from '../lib/ai/tutor/types';

// ─── Fingerprint ─────────────────────────────────────────────────────────────

/**
 * Capture the key policy decisions for reference intents.
 * If these change, a human must consciously review and update the baseline.
 */
function captureIntentFingerprint(label: string, overrides: Partial<TutorIntent>) {
  const intent: TutorIntent = {
    intent: 'explain',
    domain: 'general_academic',
    complexity: 'simple',
    requiresTool: false,
    requiresVerification: false,
    confidence: 0.9,
    ...overrides,
  };

  const plan = selectTutorStrategy(intent);
  return {
    label,
    intent: intent.intent,
    domain: intent.domain,
    complexity: intent.complexity,
    strategy: plan.strategy,
    tools: plan.tools,
    requiresVerification: plan.requiresVerification,
    reasoningLevel: plan.reasoningLevel,
    responseFormat: plan.responseFormat,
    contextBudget: plan.contextBudget,
  };
}

function main() {
  const baseline = {
    version: '7.12',
    locked_at: new Date().toISOString(),
    description: 'Medea architecture baseline at Phase 7.12 final gate',
    model_registry: {
      chat: { provider: ModelRegistry.chat.provider, model: ModelRegistry.chat.model },
      fast: { provider: ModelRegistry.fast.provider, model: ModelRegistry.fast.model },
      generate_notes: { provider: ModelRegistry.generate_notes.provider, model: ModelRegistry.generate_notes.model },
      generate_quiz: { provider: ModelRegistry.generate_quiz.provider, model: ModelRegistry.generate_quiz.model },
    },
    tool_limits: {
      max_tool_calls_per_interaction: ToolLimits.MAX_TOOL_CALLS_PER_INTERACTION,
      max_code_payload_length: ToolLimits.MAX_CODE_PAYLOAD_LENGTH,
      restricted_patterns_count: ToolLimits.RESTRICTED_CODE_PATTERNS.length,
    },
    intent_fingerprints: [
      captureIntentFingerprint('simple-explain', { intent: 'explain', complexity: 'simple' }),
      captureIntentFingerprint('math-calculation-moderate', {
        intent: 'math_calculation', domain: 'mathematics', complexity: 'moderate',
        requiresTool: true, requiresVerification: true,
      }),
      captureIntentFingerprint('physics-problem-complex', {
        intent: 'physics_problem', domain: 'physics', complexity: 'complex',
        requiresTool: true, requiresVerification: true,
      }),
      captureIntentFingerprint('chemistry-problem-moderate', {
        intent: 'chemistry_problem', domain: 'chemistry', complexity: 'moderate',
        requiresTool: true, requiresVerification: true,
      }),
      captureIntentFingerprint('check-work-moderate', {
        intent: 'check_work', domain: 'mathematics', complexity: 'moderate',
        requiresTool: true, requiresVerification: true,
      }),
      captureIntentFingerprint('hint-simple', { intent: 'hint', complexity: 'simple' }),
      captureIntentFingerprint('socratic-moderate', { intent: 'socratic', complexity: 'moderate' }),
    ],
    regression_thresholds: {
      security_violations_allowed: 0,
      billing_double_charges_allowed: 0,
      unauthorized_retrieval_allowed: 0,
      false_verified_claims_allowed: 0,
      invalid_citations_allowed: 0,
      ai_quality_pass_rate_minimum: 0.80,
      math_correctness_minimum: 0.90,
      physics_correctness_minimum: 0.90,
      chemistry_correctness_minimum: 0.85,
    },
    hard_fail_rule: 'A single security violation, unauthorized citation, unauthorized tool execution, or duplicate billing event is an automatic Phase 7 failure regardless of AI quality score.',
  };

  const outPath = path.join(__dirname, '7.12-baseline-lock.json');
  fs.writeFileSync(outPath, JSON.stringify(baseline, null, 2));
  console.log(`[7.12 Baseline] Locked to: ${outPath}`);
  console.log(JSON.stringify(baseline, null, 2));
}

main();
