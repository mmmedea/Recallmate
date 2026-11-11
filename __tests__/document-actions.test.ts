import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createDocumentUploadSession, confirmDocumentUpload } from '@/app/actions/document-actions';

// Mock dependencies
vi.mock('@/lib/security', () => ({
  requireUser: vi.fn().mockResolvedValue({ user: { id: 'user_123' }, supabase: {} }),
  requireEntitlement: vi.fn().mockResolvedValue({ isPremium: true }),
  checkRateLimit: vi.fn().mockResolvedValue(true),
  SecurityError: class SecurityError extends Error {
    status: number;
    constructor(msg: string, status: number) {
      super(msg);
      this.status = status;
    }
  }
}));

const mockSupabase = {
  from: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  single: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  rpc: vi.fn(),
  storage: {
    from: vi.fn().mockReturnThis(),
    info: vi.fn(),
    download: vi.fn()
  }
};

vi.mock('@/utils/supabase/server', () => ({
  createClient: vi.fn(() => mockSupabase)
}));

import { requireUser } from '@/lib/security';

describe('Document Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireUser as any).mockResolvedValue({ user: { id: 'user_123' }, supabase: mockSupabase });
  });

  describe('createDocumentUploadSession', () => {
    it('validates file payload and returns storage path', async () => {
      mockSupabase.single.mockResolvedValueOnce({ data: { id: 'doc_123' }, error: null });

      const res = await createDocumentUploadSession({
        fileName: 'test-file.pdf',
        fileSize: 1024,
        contentType: 'application/pdf'
      });

      expect(res.success).toBe(true);
      expect(res.documentId).toBeDefined();
      expect(res.storagePath).toMatch(/user_123\/.*\/test-file\.pdf/);
      expect(mockSupabase.insert).toHaveBeenCalledWith(expect.objectContaining({
        filename: 'test-file.pdf',
        status: 'uploaded',
        user_id: 'user_123'
      }));
    });

    it('fails if payload is invalid (e.g. negative file size)', async () => {
      const res = await createDocumentUploadSession({
        fileName: 'test-file.pdf',
        fileSize: -1,
        contentType: 'application/pdf'
      });
      
      expect(res).toHaveProperty('error');
    });
  });

  describe('confirmDocumentUpload', () => {
    it('returns error if document is in an invalid state for confirmation', async () => {
      mockSupabase.single.mockResolvedValueOnce({ data: { status: 'completed', storage_path: 'path/to/file' }, error: null });

      const res = await confirmDocumentUpload('doc_123', 'idempotency_1');
      expect(res.error).toMatch(/Document is currently in completed state/);
      expect(res.status).toBe(400);
    });

    it('returns error if file is not found in storage', async () => {
      mockSupabase.single.mockResolvedValueOnce({ data: { status: 'uploaded', storage_path: 'path/to/file' }, error: null });
      mockSupabase.storage.info.mockResolvedValueOnce({ data: null, error: { message: 'Not found' } });
      mockSupabase.storage.download.mockResolvedValueOnce({ data: null, error: { message: 'Not found' } });

      const res = await confirmDocumentUpload('doc_123', 'idempotency_1');
      expect(res.error).toBe('Uploaded file not found in storage');
    });
    
    it('calls confirm_document_upload RPC atomically', async () => {
      mockSupabase.single.mockResolvedValueOnce({ data: { status: 'uploaded', storage_path: 'path/to/file' }, error: null });
      mockSupabase.storage.info.mockResolvedValueOnce({ data: { size: 1024 }, error: null });
      const mockArrayBuffer = new ArrayBuffer(1024);
      mockSupabase.storage.download.mockResolvedValueOnce({ data: { arrayBuffer: () => mockArrayBuffer }, error: null });
      mockSupabase.rpc.mockResolvedValueOnce({ data: 'job_123', error: null });

      const res = await confirmDocumentUpload('doc_123', 'idempotency_1');
      
      expect(res.success).toBe(true);
      expect(res.jobId).toBe('job_123');
      expect(mockSupabase.rpc).toHaveBeenCalledWith('confirm_document_upload', {
        p_document_id: 'doc_123',
        p_user_id: 'user_123',
        p_idempotency_key: 'idempotency_1'
      });
    });
  });
});
