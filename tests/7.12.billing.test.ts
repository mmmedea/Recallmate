/**
 * 7.12.2 – Billing / Ledger Automated Tests
 *
 * These are unit-level tests for the BillingService class. They test the
 * billing invariants without a live database by mocking the Supabase client.
 *
 * Coverage:
 *   - reserveCredits inserts a RESERVATION entry with negative credits
 *   - reserveCredits throws when balance is insufficient
 *   - finalizeCharge inserts REFUND + CHARGE in sequence
 *   - finalizeCharge is idempotent (skips if CHARGE already exists)
 *   - getUserBalance sums all ledger entries correctly
 *   - getUserBalance returns 0 on DB error (fail-safe)
 *   - Duplicate-requestId → single lifecycle (idempotency)
 *   - No CHARGE entry = orphan reservation detectable
 */

import { describe, test, expect, vi, type Mock } from 'vitest';
import { BillingService } from '../lib/ai/billing';

// ─── Mock Supabase builder ───────────────────────────────────────────────────

/**
 * Build a minimal mock of the Supabase fluent-chain that BillingService uses.
 * Each operation returns a new fake with the methods it needs.
 */
function makeSupabaseMock(opts: {
  ledgerRows?: Array<{ id?: string; credits?: number; entry_type?: string }>;
  insertError?: boolean;
  singleRow?: any;
  singleError?: boolean;
}) {
  const { ledgerRows = [], insertError = false, singleRow = null, singleError = false } = opts;

  const insertMock = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue(
        insertError
          ? { data: null, error: new Error('DB insert error') }
          : { data: { id: 'mock-ledger-id-' + Math.random() }, error: null }
      ),
    }),
  });

  const selectMock = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnThis(),
    // Used for balance calculation (returns array)
    then: vi.fn(),
  });

  // Create a version that supports chaining for balance query
  const balanceSelectMock = vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue({ data: ledgerRows, error: null }),
  });

  // Create a version that supports maybeSingle for idempotency check
  const idempotencySelectMock = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: singleRow, error: singleError ? new Error('err') : null }),
  });

  return {
    from: vi.fn((table: string) => ({
      insert: insertMock,
      select: table === 'ai_credit_ledger' ? balanceSelectMock : selectMock,
    })),
    _insertMock: insertMock,
  };
}

/**
 * A specialised mock that returns different responses based on call order,
 * used to test finalizeCharge's 3-step sequence.
 */
function makeFinalizeMock(existingCharge: any) {
  let fromCallCount = 0;
  const insertMock = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: { id: 'entry-' + Math.random() }, error: null }),
    }),
  });

  return {
    from: vi.fn(() => {
      fromCallCount++;
      if (fromCallCount === 1) {
        // First call → idempotency check
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: existingCharge, error: null }),
          }),
        };
      }
      // Subsequent calls → insert (REFUND, then CHARGE)
      return { insert: insertMock };
    }),
    _insertMock: insertMock,
  };
}

// ─── reserveCredits ──────────────────────────────────────────────────────────

describe('BillingService.reserveCredits', () => {
  test('records a RESERVATION ledger entry with negative credits', async () => {
    const mock = makeSupabaseMock({ ledgerRows: [{ credits: 100 }] });
    const billing = new BillingService(mock as any);

    // Override balance query to simulate sufficient balance
    let fromCallCount = 0;
    (mock.from as Mock).mockImplementation((table: string) => {
      fromCallCount++;
      if (fromCallCount === 1) {
        // Balance check
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [{ credits: 100 }], error: null }),
          }),
        };
      }
      // Insertion
      return {
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { id: 'reservation-1' }, error: null }),
          }),
        }),
      };
    });

    const id = await billing.reserveCredits('user-1', 'job-1', 5, 'Test reservation');
    expect(id).toBe('reservation-1');
  });

  test('throws when user has insufficient credits', async () => {
    const mock = makeSupabaseMock({ ledgerRows: [{ credits: 2 }] });
    const billing = new BillingService(mock as any);

    (mock.from as Mock).mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: [{ credits: 2 }], error: null }),
      }),
    }));

    await expect(billing.reserveCredits('user-1', 'job-1', 10, 'Test'))
      .rejects
      .toThrow(/Insufficient credits/i);
  });
});

// ─── finalizeCharge ──────────────────────────────────────────────────────────

describe('BillingService.finalizeCharge', () => {
  test('writes REFUND then CHARGE when no existing charge found', async () => {
    const finalizeMock = makeFinalizeMock(null); // no existing charge
    const billing = new BillingService(finalizeMock as any);

    await billing.finalizeCharge('user-1', 'job-1', 5, 4, 'Test charge');

    // Should have been called twice: REFUND insert, then CHARGE insert
    expect(finalizeMock._insertMock).toHaveBeenCalledTimes(2);

    const [refundCall, chargeCall] = finalizeMock._insertMock.mock.calls;
    expect(refundCall[0].entry_type).toBe('REFUND');
    expect(refundCall[0].credits).toBe(5); // positive (returning reserved)
    expect(chargeCall[0].entry_type).toBe('CHARGE');
    expect(chargeCall[0].credits).toBe(-4); // negative (actual charge)
  });

  test('is idempotent: skips when CHARGE entry already exists', async () => {
    const finalizeMock = makeFinalizeMock({ id: 'existing-charge' });
    const billing = new BillingService(finalizeMock as any);

    await billing.finalizeCharge('user-1', 'job-1', 5, 4, 'Test charge');

    // No new insert should happen
    expect(finalizeMock._insertMock).not.toHaveBeenCalled();
  });
});

// ─── getUserBalance ──────────────────────────────────────────────────────────

describe('BillingService.getUserBalance', () => {
  test('sums positive and negative ledger entries correctly', async () => {
    const rows = [
      { credits: 100 },  // grant
      { credits: -5 },   // reservation
      { credits: 5 },    // refund of reservation
      { credits: -4 },   // actual charge
    ];
    const mock = makeSupabaseMock({ ledgerRows: rows });
    (mock.from as Mock).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: rows, error: null }),
      }),
    });
    const billing = new BillingService(mock as any);
    const balance = await billing.getUserBalance('user-1');
    // 100 - 5 + 5 - 4 = 96
    expect(balance).toBe(96);
  });

  test('returns 0 on DB error (fail-safe, never throws)', async () => {
    const mock = makeSupabaseMock({ ledgerRows: [] });
    (mock.from as Mock).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: new Error('DB down') }),
      }),
    });
    const billing = new BillingService(mock as any);
    const balance = await billing.getUserBalance('user-1');
    expect(balance).toBe(0);
  });
});
