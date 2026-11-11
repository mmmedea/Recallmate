import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(), upsert: vi.fn(), configured: vi.fn(),
}));
vi.mock('@/utils/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: mocks.getUser } }),
}));
vi.mock('@/lib/supabase/admin', () => ({
  isSupabaseAdminConfigured: mocks.configured,
  createSupabaseAdminClient: () => ({ from: () => ({ upsert: mocks.upsert }) }),
}));
import { POST } from '@/app/api/premium/verify/route';

const request = () => new Request('https://recallmate-ai.vercel.app/api/premium/verify', {
  method: 'POST', body: JSON.stringify({ password: 'test-activation-secret' }),
});

describe('Premium activation authority', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv('PREMIUM_PASSWORD', 'test-activation-secret');
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'student' } }, error: null });
    mocks.configured.mockReturnValue(true);
    mocks.upsert.mockResolvedValue({ error: null });
  });
  it('requires authentication before activation', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    expect((await POST(request())).status).toBe(401);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
  it('has no default activation password', async () => {
    vi.stubEnv('PREMIUM_PASSWORD', '');
    expect((await POST(request())).status).toBe(503);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
  it('does not report success or set a premium cookie when persistence fails', async () => {
    mocks.upsert.mockResolvedValue({ error: { code: 'database_unavailable' } });
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(response.headers.get('set-cookie')).toBeNull();
  });
  it('persists the authenticated entitlement and expires the obsolete cookie', async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(mocks.upsert).toHaveBeenCalledWith({ user_id: 'student', tier: 'premium' }, { onConflict: 'user_id' });
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
  });
});
