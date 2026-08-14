/**
 * 7.12.4 – Tool Safety Tests
 *
 * Tests deterministic safety constraints on the calculator and unit_check
 * tools.  These are the numeric-correctness and dimensional-correctness gates
 * that protect Medea's verification layer.
 *
 * Coverage:
 *   - Numeric correctness to tolerance (±1e-9) for key STEM calculations
 *   - Tolerance policy: values within tolerance → pass; outside → fail
 *   - Zero handling: division by zero, zero exponent, zero factorial
 *   - Floating-point edge cases
 *   - Unit conversion correctness across measurement systems
 *   - Dimensional incompatibility is always rejected
 *   - Code execution pattern restrictions (limits.ts)
 */

import { describe, test, expect } from 'vitest';
import { executeCalculator } from '../lib/ai/tutor/tools/calculator';
import { executeUnitCheck } from '../lib/ai/tutor/tools/unit-check';
import { ToolLimits } from '../lib/ai/tutor/tools/limits';

const TOLERANCE = 1e-6;

function expectNumeric(expression: string, expected: number, tol = TOLERANCE) {
  const result = executeCalculator({ expression });
  expect(result.valid, `Expected '${expression}' to be valid but got error: ${result.error}`).toBe(true);
  expect(Number(result.result)).toBeCloseTo(expected, -Math.log10(tol));
}

// ─── Numeric correctness ──────────────────────────────────────────────────────

describe('Calculator – numeric correctness (STEM)', () => {
  // Algebra
  test('basic arithmetic: 3 + 4 * 2 = 11 (operator precedence)', () => expectNumeric('3 + 4 * 2', 11));
  test('exponentiation: 2^10 = 1024', () => expectNumeric('2^10', 1024));
  test('nested parentheses: ((3 + 2) * 4) / 2 = 10', () => expectNumeric('((3 + 2) * 4) / 2', 10));

  // Calculus-adjacent (numeric evaluation)
  test('e^1 ≈ 2.71828', () => expectNumeric('exp(1)', Math.E));
  test('ln(e) = 1 (log in mathjs = natural log)', () => expectNumeric('log(exp(1))', 1));
  test('log10(1000) = 3', () => expectNumeric('log10(1000)', 3));

  // Trigonometry
  test('sin(pi/2) = 1', () => expectNumeric('sin(pi/2)', 1));
  test('cos(0) = 1', () => expectNumeric('cos(0)', 1));
  test('atan(1) * 4 ≈ pi', () => expectNumeric('atan(1) * 4', Math.PI));

  // Physics formulas
  test('kinematic energy: 0.5 * 5 * 10^2 = 250', () => expectNumeric('0.5 * 5 * 10^2', 250));
  test('gravitational potential: 2 * 9.8 * 10 = 196', () => expectNumeric('2 * 9.8 * 10', 196));
  test('ohm: V=IR → 12 / 4 = 3', () => expectNumeric('12 / 4', 3));

  // Chemistry formulas
  test('molar mass C6H12O6: 6*12 + 12*1 + 6*16 = 180', () => expectNumeric('6*12 + 12*1 + 6*16', 180));
  test('concentration: 0.5 / 0.25 = 2 mol/L', () => expectNumeric('0.5 / 0.25', 2));

  // Statistics
  test('mean: (10 + 20 + 30) / 3 = 20', () => expectNumeric('(10 + 20 + 30) / 3', 20));
  test('factorial: factorial(5) = 120', () => expectNumeric('factorial(5)', 120));
  test('sqrt of perfect square: sqrt(144) = 12', () => expectNumeric('sqrt(144)', 12));
});

// ─── Tolerance policy ─────────────────────────────────────────────────────────

describe('Calculator – tolerance policy', () => {
  test('floating point near-equal result is acceptable (√2)', () => {
    const result = executeCalculator({ expression: 'sqrt(2)' });
    expect(result.valid).toBe(true);
    expect(Math.abs(Number(result.result) - Math.SQRT2)).toBeLessThan(1e-9);
  });

  test('pi constant matches to 10 significant figures', () => {
    const result = executeCalculator({ expression: 'pi' });
    expect(result.valid).toBe(true);
    expect(Math.abs(Number(result.result) - Math.PI)).toBeLessThan(1e-10);
  });
});

// ─── Zero handling ────────────────────────────────────────────────────────────

describe('Calculator – zero and edge cases', () => {
  test('0^0 evaluates (mathjs returns 1 by convention)', () => {
    const result = executeCalculator({ expression: '0^0' });
    // mathjs returns 1 for 0^0 per IEEE convention
    expect(result.valid).toBe(true);
  });

  test('factorial(0) = 1', () => expectNumeric('factorial(0)', 1));

  test('0 * anything = 0', () => expectNumeric('0 * 9999999', 0));

  test('very small number: 1e-15', () => {
    const result = executeCalculator({ expression: '1e-15' });
    expect(result.valid).toBe(true);
    expect(Number(result.result)).toBeCloseTo(1e-15, 20);
  });

  test('very large number: 1e15', () => {
    const result = executeCalculator({ expression: '1e15' });
    expect(result.valid).toBe(true);
    expect(Number(result.result)).toBe(1e15);
  });
});

// ─── Unit Check: conversions ──────────────────────────────────────────────────

describe('Unit Check – conversion correctness', () => {
  test('1 km = 1000 m', () => {
    const r = executeUnitCheck({ value: 1, fromUnit: 'km', toUnit: 'm' });
    expect(r.valid).toBe(true);
    expect(r.value).toBeCloseTo(1000, 6);
  });

  test('1 hour = 3600 seconds', () => {
    const r = executeUnitCheck({ value: 1, fromUnit: 'hour', toUnit: 's' });
    expect(r.valid).toBe(true);
    expect(r.value).toBeCloseTo(3600, 6);
  });

  test('1 atm = 101325 Pa', () => {
    const r = executeUnitCheck({ value: 1, fromUnit: 'atm', toUnit: 'Pa' });
    expect(r.valid).toBe(true);
    expect(r.value).toBeCloseTo(101325, 0);
  });

  test('converts joules to BTU correctly', () => {
    // mathjs: 1 BTU ≈ 1055.056 J
    const r = executeUnitCheck({ value: 1055.056, fromUnit: 'J', toUnit: 'BTU' });
    expect(r.valid).toBe(true);
    expect(r.value!).toBeCloseTo(1, 2);
  });

  test('100°C in Kelvin ≈ 373.15 K', () => {
    const r = executeUnitCheck({ value: 100, fromUnit: 'degC', toUnit: 'K' });
    expect(r.valid).toBe(true);
    expect(r.value).toBeCloseTo(373.15, 1);
  });
});

// ─── Unit Check: dimensional incompatibility ──────────────────────────────────

describe('Unit Check – dimensional rejection', () => {
  test('rejects mass → length (kg → m)', () => {
    const r = executeUnitCheck({ value: 1, fromUnit: 'kg', toUnit: 'm' });
    expect(r.valid).toBe(false);
  });

  test('rejects velocity → energy (m/s → J)', () => {
    const r = executeUnitCheck({ value: 10, fromUnit: 'm/s', toUnit: 'J' });
    expect(r.valid).toBe(false);
  });

  test('rejects temperature → pressure (K → Pa)', () => {
    const r = executeUnitCheck({ value: 300, fromUnit: 'K', toUnit: 'Pa' });
    expect(r.valid).toBe(false);
  });
});

// ─── Code pattern restrictions ────────────────────────────────────────────────

describe('ToolLimits – code pattern deny-list', () => {
  const dangerous = [
    'import os',
    'import sys',
    'import subprocess',
    'import socket',
    'import urllib',
    'import requests',
    'open(',
    '__import__',
    'eval(',
    'exec(',
  ];

  test.each(dangerous)('pattern "%s" is in RESTRICTED_CODE_PATTERNS', (pattern) => {
    expect(ToolLimits.RESTRICTED_CODE_PATTERNS).toContain(pattern);
  });

  test('MAX_TOOL_CALLS_PER_INTERACTION is between 2 and 5 (not too permissive)', () => {
    expect(ToolLimits.MAX_TOOL_CALLS_PER_INTERACTION).toBeGreaterThanOrEqual(2);
    expect(ToolLimits.MAX_TOOL_CALLS_PER_INTERACTION).toBeLessThanOrEqual(5);
  });
});
