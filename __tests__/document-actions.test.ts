import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createDocumentUploadSession, confirmDocumentUpload } from '@/app/actions/document-actions';

const { mockAdminClient, mockSupabase, USER_ID, DOCUMENT_ID, IDEMPOTENCY_KEY } = vi.hoisted(() => ({
  mockAdminClient: { rpc: vi.fn() },
  mockSupabase: {
    from: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    storage: {
      from: vi.fn().mockReturnThis(),
      list: vi.fn(),
    },
  },
  USER_ID: '11111111-1111-4111-8111-111111111111',
  DOCUMENT_ID: '22222222-2222-4222-8222-222222222222',
  IDEMPOTENCY_KEY: '33333333-3333-4333-8333-333333333333',
}));

// Mock dependencies
vi.mock('@/lib/security', () => ({
  requireUser: vi.fn().mockResolvedValue({ user: { id: USER_ID }, supabase: {} }),
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



vi.mock('@/utils/supabase/server', () => ({
  createClient: vi.fn(() => mockSupabase)
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockAdminClient)
}));

import { requireUser } from '@/lib/security';

describe('Document Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
    (requireUser as any).mockResolvedValue({ user: { id: USER_ID }, supabase: mockSupabase });
  });

  describe('createDocumentUploadSession', () => {
    it('validates file payload and returns storage path', async () => {
      mockSupabase.single.mockResolvedValueOnce({ data: { id: DOCUMENT_ID }, error: null });

      const res = await createDocumentUploadSession({
        fileName: 'test-file.pdf',
        fileSize: 1024,
        contentType: 'application/pdf'
      });

      expect(res.success).toBe(true);
      expect(res.documentId).toBeDefined();
      expect(res.storagePath).toMatch(new RegExp(`${USER_ID}/.*/test-file\\.pdf`));
      expect(mockSupabase.insert).toHaveBeenCalledWith(expect.objectContaining({
        filename: 'test-file.pdf',
        status: 'uploaded',
        user_id: USER_ID
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
      mockSupabase.single.mockResolvedValueOnce({
        data: { status: 'completed', storage_path: `${USER_ID}/${DOCUMENT_ID}/file.pdf` },
        error: null
      });

      const res = await confirmDocumentUpload(DOCUMENT_ID, IDEMPOTENCY_KEY);
      expect(res.error).toMatch(/Document is currently in completed state/);
      expect(res.status).toBe(400);
      expect(mockAdminClient.rpc).not.toHaveBeenCalled();
    });

    it('returns error if file is not found in storage', async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: { status: 'uploaded', storage_path: `${USER_ID}/${DOCUMENT_ID}/file.pdf` },
        error: null
      });
      mockSupabase.storage.list.mockResolvedValueOnce({ data: [], error: null });

      const res = await confirmDocumentUpload(DOCUMENT_ID, IDEMPOTENCY_KEY);
      expect(res.error).toBe('Uploaded file not found in storage');
      expect(mockAdminClient.rpc).not.toHaveBeenCalled();
    });

    it('calls the service-role confirmation RPC after checking ownership and storage', async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: { status: 'uploaded', storage_path: `${USER_ID}/${DOCUMENT_ID}/file.pdf` },
        error: null
      });
      mockSupabase.storage.list.mockResolvedValueOnce({
        data: [{ name: 'file.pdf', metadata: { size: 1024 } }],
        error: null
      });
      mockAdminClient.rpc.mockResolvedValueOnce({ data: 'job_123', error: null });

      const res = await confirmDocumentUpload(DOCUMENT_ID, IDEMPOTENCY_KEY);

      expect(res.success).toBe(true);
      expect(res.jobId).toBe('job_123');
      expect(mockAdminClient.rpc).toHaveBeenCalledWith('confirm_document_upload', {
        p_document_id: DOCUMENT_ID,
        p_user_id: USER_ID,
        p_idempotency_key: IDEMPOTENCY_KEY
      });
    });

    it('rejects non-UUID document and idempotency identifiers', async () => {
      const res = await confirmDocumentUpload('doc_123', 'idempotency_1');
      expect(res.error).toBe('Invalid upload confirmation request');
      expect(res.status).toBe(400);
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });
  });
});
