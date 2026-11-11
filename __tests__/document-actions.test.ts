import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createDocumentUploadSession, confirmDocumentUpload, deleteDocument } from '@/app/actions/document-actions';
import { MAX_DOCUMENT_UPLOAD_BYTES, MAX_DOCUMENT_UPLOAD_MB } from '@/lib/constants';

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

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
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
    list: vi.fn(),
    info: vi.fn(),
    download: vi.fn()
  }
};

const mockAdminSupabase = {
  from: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  single: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  rpc: vi.fn(),
  storage: {
    from: vi.fn().mockReturnThis(),
    remove: vi.fn()
  }
};

vi.mock('@/lib/supabase/admin', () => ({
  SUPABASE_ADMIN_CONFIG_ERROR_CODE: 'ADMIN_SUPABASE_NOT_CONFIGURED',
  createSupabaseAdminClient: vi.fn(() => mockAdminSupabase),
  isSupabaseAdminConfigError: vi.fn((error: unknown) => {
    return error instanceof Error && error.name === 'SupabaseAdminConfigError';
  }),
}));

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
      mockAdminSupabase.single.mockResolvedValueOnce({ data: { id: 'doc_123' }, error: null });

      const res = await createDocumentUploadSession({
        fileName: 'test-file.pdf',
        fileSize: 1024,
        contentType: 'application/pdf'
      });

      expect(res.success).toBe(true);
      expect(res.documentId).toBeDefined();
      expect(res.storagePath).toMatch(/user_123\/.*\/test-file\.pdf/);
      expect(mockAdminSupabase.insert).toHaveBeenCalledWith(expect.objectContaining({
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
      mockSupabase.storage.list.mockResolvedValueOnce({ data: [], error: null });

      const res = await confirmDocumentUpload('doc_123', 'idempotency_1');
      expect(res.error).toBe('Uploaded file not found in storage');
    });
    
    it('calls confirm_document_upload RPC atomically', async () => {
      mockSupabase.single.mockResolvedValueOnce({ data: { status: 'uploaded', storage_path: 'path/to/file' }, error: null });
      mockSupabase.storage.list.mockResolvedValueOnce({ data: [{ name: 'file', metadata: { size: 1024 } }], error: null });
      mockAdminSupabase.rpc.mockResolvedValueOnce({ data: 'job_123', error: null });

      const res = await confirmDocumentUpload('doc_123', 'idempotency_1');
      
      expect(res.success).toBe(true);
      expect(res.jobId).toBe('job_123');
      expect(mockAdminSupabase.rpc).toHaveBeenCalledWith('confirm_document_upload', {
        p_document_id: 'doc_123',
        p_user_id: 'user_123',
        p_idempotency_key: 'idempotency_1'
      });
    });

    it('accepts files up to the configured document upload limit', async () => {
      mockSupabase.single.mockResolvedValueOnce({ data: { status: 'uploaded', storage_path: 'path/to/file' }, error: null });
      mockSupabase.storage.list.mockResolvedValueOnce({ data: [{ name: 'file', metadata: { size: MAX_DOCUMENT_UPLOAD_BYTES } }], error: null });
      mockAdminSupabase.rpc.mockResolvedValueOnce({ data: 'job_123', error: null });

      const res = await confirmDocumentUpload('doc_123', 'idempotency_1');
      expect(res.success).toBe(true);
    });

    it('rejects files above the configured document upload limit', async () => {
      mockSupabase.single.mockResolvedValueOnce({ data: { status: 'uploaded', storage_path: 'path/to/file' }, error: null });
      mockSupabase.storage.list.mockResolvedValueOnce({ data: [{ name: 'file', metadata: { size: MAX_DOCUMENT_UPLOAD_BYTES + 1 } }], error: null });

      const res = await confirmDocumentUpload('doc_123', 'idempotency_1');
      expect(res.error).toBe(`File exceeds ${MAX_DOCUMENT_UPLOAD_MB}MB limit`);
      expect(res.status).toBe(400);
    });

    it('uses the admin client for destructive document deletion after ownership verification', async () => {
      mockSupabase.single.mockResolvedValueOnce({ data: { id: 'doc_123', storage_path: 'user_123/doc_123/file.pdf' }, error: null });
      mockAdminSupabase.storage.remove.mockResolvedValueOnce({ data: null, error: null });

      const res = await deleteDocument('doc_123');

      expect(res.success).toBe(true);
      expect(mockAdminSupabase.storage.remove).toHaveBeenCalledWith(['user_123/doc_123/file.pdf']);
      expect(mockAdminSupabase.delete).toHaveBeenCalled();
      expect(mockAdminSupabase.eq).toHaveBeenCalledWith('user_id', 'user_123');
    });
  });
});
