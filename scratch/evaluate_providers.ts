import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import * as fs from 'fs';
import * as path from 'path';
import { ProviderAdapter } from '../lib/ai/provider';
import { ModelRegistry } from '../lib/ai/config';
import { ChatGenAISchema, GeneratedChat } from '../lib/ai/schemas';
import { detectTutorIntent } from '../lib/ai/tutor/intent';
import { selectTutorStrategy } from '../lib/ai/tutor/strategy';
import { VerificationOrchestrator } from '../lib/ai/tutor/verification/orchestrator';

const GOLDEN_PATH = path.join(__dirname, '../tests/ai-evals/medea-golden.json');
const goldenCases = JSON.parse(fs.readFileSync(GOLDEN_PATH, 'utf-8'));

type ProviderConfig = {
  provider: 'google' | 'deepseek';
  model: string;
};

// Rate-limiter and retry logic
async function rateLimitedCall<T>(fn: () => Promise<T>, provider: string): Promise<T> {
  let attempt = 0;
  let maxAttempts = 5;
  
  while (attempt < maxAttempts) {
    try {
      // Base pacing for Google free tier (5 RPM = 1 req / 12 sec)
      if (provider === 'google') {
        await new Promise(r => setTimeout(r, 13500));
      }
      return await fn();
    } catch (e: any) {
      const msg = e.message || '';
      // Hard fail on config errors
      if (msg.includes('401') || msg.includes('402') || msg.includes('404')) {
        throw e;
      }
      // Retry on rate limits or transient errors
      if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('fetch failed')) {
        attempt++;
        if (attempt >= maxAttempts) throw new Error('RATE_LIMIT_EXHAUSTED');
        const backoff = Math.pow(2, attempt) * 5000 + (Math.random() * 2000); // jitter
        console.log(`\n  -> [Rate Limit] 429 hit. Waiting ${Math.round(backoff/1000)}s before attempt ${attempt+1}...`);
        await new Promise(r => setTimeout(r, backoff));
      } else {
        throw e;
      }
    }
  }
  throw new Error('RATE_LIMIT_EXHAUSTED');
}

// Global cache for Generation-only runs
const cachedIntents = new Map<string, any>();
const cachedPlans = new Map<string, any>();

async function evaluateRun(
  runName: string, 
  config: ProviderConfig, 
  useCachedPlan: boolean
) {
  console.log(`\n=================================================`);
  console.log(`RUN: ${runName}`);
  console.log(`Generation Provider: ${config.provider} (${config.model})`);
  console.log(`Strategy Mode: ${useCachedPlan ? 'CACHED (Generation-Only)' : 'E2E (Dynamic Intent)'}`);
  console.log(`=================================================`);

  let totalLatency = 0;
  let totalInput = 0, totalOutput = 0, totalCost = 0;
  let stats: any = {
    total: goldenCases.length,
    passed: 0,
    failed: 0,
    hardFails: 0,
    skipped: 0,
    verificationSuccess: 0,
    intentAccuracy: 0,
    domains: { math: 0, physics: 0, chemistry: 0, general: 0 }
  };

  for (const c of goldenCases) {
    process.stdout.write(`[${c.id}] Processing... `);
    const start = Date.now();
    
    try {
      // 1. INTENT & STRATEGY
      let intent;
      let plan;
      
      if (useCachedPlan && cachedIntents.has(c.id)) {
        intent = cachedIntents.get(c.id);
        plan = cachedPlans.get(c.id);
      } else {
        // Run Intent dynamically
        process.env.AI_PROVIDER_FAST = config.provider;
        process.env.GEMINI_MODEL_FAST = config.model;
        ModelRegistry.fast.provider = config.provider;
        ModelRegistry.fast.model = config.model;

        intent = await rateLimitedCall(() => detectTutorIntent(c.prompt, "Evaluation Document", ""), config.provider);
        plan = selectTutorStrategy(intent);
        
        // Cache it if this is the E2E run and it's the control provider
        if (config.provider === 'google' && !useCachedPlan) {
          cachedIntents.set(c.id, intent);
          cachedPlans.set(c.id, plan);
        }
      }

      if (intent.intent === c.intent) stats.intentAccuracy++;
      
      // 2. GENERATION
      process.env.AI_PROVIDER_CHAT = config.provider;
      process.env.GEMINI_MODEL_CHAT = config.model;
      ModelRegistry.chat.provider = config.provider;
      ModelRegistry.chat.model = config.model;

      const systemPrompt = `You are the Medea Tutor.
Intent: ${intent.intent}
Tools Allowed: ${plan.tools.join(', ')}

Context:
${c.documentContext}`;

      const res = await rateLimitedCall(() => 
        ProviderAdapter.executeStructuredGeneration<GeneratedChat>(
          'chat', systemPrompt, c.prompt, ChatGenAISchema
        ), config.provider
      );
      
      const latency = Date.now() - start;
      totalLatency += latency;
      totalInput += res.usage.inputTokens;
      totalOutput += res.usage.outputTokens;
      
      // 3. VERIFICATION
      const orch = new VerificationOrchestrator(plan);
      const verification = orch.verify([]);
      if (verification.verified === c.expected.verificationRequired) {
        stats.verificationSuccess++;
      }

      // 4. SCORING (Deterministic Numeric Check)
      let pass = true;
      if (c.expected.numericAnswer !== null && c.expected.numericAnswer !== undefined) {
         if (!res.data.answer.includes(c.expected.numericAnswer.toString())) {
             pass = false;
         }
      }

      if (pass) {
        stats.passed++;
        if (c.domain.includes('math')) stats.domains.math++;
        if (c.domain.includes('physics')) stats.domains.physics++;
        if (c.domain.includes('chemistry')) stats.domains.chemistry++;
      } else {
        stats.failed++;
        if (c.expected.hardFailOn && c.expected.hardFailOn.length > 0) stats.hardFails++;
      }

      console.log(`${pass ? 'PASS' : 'FAIL'} (${latency}ms)`);

    } catch (e: any) {
      const msg = e.message || '';
      
      if (msg.includes('RATE_LIMIT_EXHAUSTED')) {
        console.log(`SKIPPED (Rate Limit Exhausted)`);
        stats.skipped++;
      } else if (msg.includes('401') || msg.includes('402') || msg.includes('404')) {
        console.error(`\n[!] CONFIG ERROR: ${msg}`);
        stats.skipped++; // Don't crash entire script, just skip and record, let caller decide
        console.log(`SKIPPED (Config Error)`);
      } else {
        console.log(`FAIL (${msg})`);
        stats.failed++;
        stats.hardFails++;
      }
    }
  }

  let inputCostPerM = config.provider === 'google' ? 0.075 : 0.14;
  let outputCostPerM = config.provider === 'google' ? 0.30 : 0.28;
  totalCost = ((totalInput / 1_000_000) * inputCostPerM) + ((totalOutput / 1_000_000) * outputCostPerM);

  return {
    Run: runName,
    Provider: config.provider,
    Passed: stats.passed,
    Failed: stats.failed,
    HardFails: stats.hardFails,
    Skipped: stats.skipped,
    IntentAcc: `${Math.round((stats.intentAccuracy / stats.total) * 100)}%`,
    AvgLatency: `${Math.round(totalLatency / (stats.total - stats.skipped || 1))}ms`,
    Cost: `$${totalCost.toFixed(5)}`
  };
}

async function main() {
  const reports = [];
  try {
    const geminiConfig: ProviderConfig = { provider: 'google', model: 'gemini-3.6-flash' };
    const deepseekConfig: ProviderConfig = { provider: 'deepseek', model: 'deepseek-chat' };

    console.log("Starting Medea Provider A/B Evaluation Suite...");

    // RUN 1: E2E Gemini (Populates cache)
    reports.push(await evaluateRun("E2E Gemini", geminiConfig, false));
    
    // RUN 2: GenOnly Gemini (Uses cache)
    reports.push(await evaluateRun("GenOnly Gemini", geminiConfig, true));

    // RUN 3: E2E DeepSeek
    reports.push(await evaluateRun("E2E DeepSeek", deepseekConfig, false));
    
    // RUN 4: GenOnly DeepSeek (Uses Gemini's cache)
    reports.push(await evaluateRun("GenOnly DeepSeek", deepseekConfig, true));

    console.log(`\n\n=== FINAL METRICS RELEASE TABLE ===\n`);
    console.table(reports);

    // Save final report, stripping any secrets
    const reportPath = path.join(__dirname, '7.13-ab-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(reports, null, 2), 'utf-8');
    console.log(`\nDetailed report saved to: ${reportPath}`);

  } catch (e) {
    console.error("Evaluation framework crashed:", e);
  }
}

main();
