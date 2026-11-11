import { describe, expect, it, vi } from 'vitest';
import { createMedeaRequest, medeaHref } from '@/lib/medea-navigation';

describe('Medea navigation', () => {
  it('creates a global request without inventing a document', () => {
    expect(createMedeaRequest({ source: 'topbar' }, 123)).toEqual({ source: 'topbar', nonce: 123 });
  });

  it('carries the selected document', () => {
    expect(createMedeaRequest({ documentId: 'document-123', source: 'study-hub' }, 456)).toEqual({
      documentId: 'document-123', source: 'study-hub', nonce: 456,
    });
  });

  it('trims ids and suggested prompts, and omits blank values', () => {
    expect(createMedeaRequest({ documentId: '  document-123  ', source: 'dashboard', suggestedPrompt: '  Explain this simply  ' }, 789)).toEqual({
      documentId: 'document-123', source: 'dashboard', suggestedPrompt: 'Explain this simply', nonce: 789,
    });
    expect(createMedeaRequest({ documentId: ' ', suggestedPrompt: '\n' }, 0)).toEqual({ nonce: 0 });
  });

  it('creates a fresh request even for launches within the same millisecond', () => {
    const clock = vi.spyOn(Date, 'now').mockReturnValue(1000);
    try {
      expect(createMedeaRequest().nonce).not.toBe(createMedeaRequest().nonce);
    } finally {
      clock.mockRestore();
    }
  });

  it('keeps old URLs for compatibility only and encodes the document id', () => {
    expect(medeaHref()).toBe('/dashboard?medea=1');
    expect(medeaHref('document-123')).toBe('/chat?documentId=document-123');
    expect(medeaHref('doc&source=wrong')).toBe('/chat?documentId=doc%26source%3Dwrong');
  });
});
