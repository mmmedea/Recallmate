import { describe, it, expect, vi, beforeEach } from 'vitest';
import { orchestrateGeneration } from '@/lib/workers/orchestrator';

describe('orchestrateGeneration', () => {
  let mockSupabase: any;

  beforeEach(() => {
    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
      insert: vi.fn().mockResolvedValue({ error: null })
    };
  });

  it('queues generate_notes and generate_quiz when auto_generate is true', async () => {
    // Mock user having auto_generate = true
    mockSupabase.single.mockResolvedValueOnce({ data: { auto_generate: true }, error: null });

    await orchestrateGeneration(mockSupabase, 'user_123', 'doc_456');

    expect(mockSupabase.from).toHaveBeenCalledWith('preferences');
    expect(mockSupabase.from).toHaveBeenCalledWith('ai_jobs');
    expect(mockSupabase.insert).toHaveBeenCalledWith([
      expect.objectContaining({ operation: 'generate_notes', document_id: 'doc_456' }),
      expect.objectContaining({ operation: 'generate_quiz', document_id: 'doc_456' })
    ]);
  });

  it('skips queuing jobs when auto_generate is false', async () => {
    // Mock user having auto_generate = false
    mockSupabase.single.mockResolvedValueOnce({ data: { auto_generate: false }, error: null });

    await orchestrateGeneration(mockSupabase, 'user_123', 'doc_456');

    expect(mockSupabase.from).toHaveBeenCalledWith('preferences');
    expect(mockSupabase.insert).not.toHaveBeenCalled();
  });

  it('defaults to true if preferences are missing (PGRST116)', async () => {
    // Mock user having no preferences row
    mockSupabase.single.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } });

    await orchestrateGeneration(mockSupabase, 'user_123', 'doc_456');

    expect(mockSupabase.insert).toHaveBeenCalled();
  });
});
