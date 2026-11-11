// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn(), from: vi.fn() }));
vi.mock('@/utils/supabase/server', () => ({ createClient: async () => ({ auth: { getUser: mocks.getUser } }) }));
vi.mock('@/lib/supabase/admin', () => ({ createSupabaseAdminClient: () => mocks, isSupabaseAdminConfigError: () => false }));
vi.mock('@/lib/learning/scheduler', () => ({ getNextLearningState: () => ({ scheduledDays: 1, newState: {
  state: 1, due_at: new Date('2026-09-14'), stability: 1, difficulty: 1, reps: 1, lapses: 1,
} }) }));
import { POST } from '@/app/api/learning/review/route';
const uid = '11111111-1111-4111-8111-111111111111';
function request() { return new NextRequest('https://recallmate-ai.vercel.app/api/learning/review', {
  method: 'POST', body: JSON.stringify({ learningItemId: uid, reviewSessionId: uid, requestId: uid, wasCorrect: false, rating: 1 }),
}); }
beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: { id: uid } }, error: null });
  mocks.rpc.mockResolvedValue({ data: { status: 'processed', hearts: 17, heartCap: 15, heartsDelta: -1, premium: false }, error: null });
  mocks.from.mockImplementation((table) => {
    const chain: any = { select: () => chain, eq: () => chain,
      single: async () => ({ data: { id: uid, question_id: uid, state: 0, due_at: '2026-09-13', stability: 0, difficulty: 0, reps: 0, lapses: 0 } }),
      maybeSingle: async () => ({ data: { tier: 'free' }, error: null }),
    };
    if (!['learning_items', 'user_entitlements'].includes(table)) throw new Error('Unexpected post-commit persistence');
    return chain;
  });
});
describe('atomic review response', () => {
  it('returns the transaction wallet without a second persistence operation', async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect((await response.json()).economy.hearts).toBe(17);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.from.mock.calls.map(c => c[0])).toEqual(['learning_items', 'user_entitlements']);
  });
  it('does not invent zero hearts when the RPC response is incomplete', async () => {
    mocks.rpc.mockResolvedValue({ data: { status: 'processed' }, error: null });
    const response = await POST(request());
    expect(response.status).toBe(500);
    expect(await response.json()).not.toHaveProperty('economy');
  });
  it('returns the explicit zero-heart code on rejected mutation', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'No hearts remaining' } });
    const response = await POST(request());
    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe('NO_HEARTS');
  });
  it('rejects signed-out mutation before any admin operation', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect((await POST(request())).status).toBe(401);
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
