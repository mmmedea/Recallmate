// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DocumentLifecycleSummary } from '@/app/actions/document-lifecycle';
import type { AppBootstrap } from '@/lib/types/auth';

const navigation = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn(), search: '' }));
const realtime = vi.hoisted(() => {
  const channel = { on: vi.fn().mockReturnThis(), subscribe: vi.fn().mockReturnThis() };
  return { channel: vi.fn(() => channel), removeChannel: vi.fn() };
});
vi.mock('next/navigation', () => ({ useRouter: () => navigation, usePathname: () => '/dashboard', useSearchParams: () => new URLSearchParams(navigation.search) }));
vi.mock('@/utils/supabase/client', () => ({ createClient: () => realtime }));
vi.mock('@/app/actions/document-actions', () => ({
  getDocumentLifecycle: vi.fn(), retryDocumentExtraction: vi.fn(), retryStudyGeneration: vi.fn(),
}));

vi.mock('idb-keyval', () => ({ get: vi.fn().mockResolvedValue(null), set: vi.fn().mockResolvedValue(undefined), del: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/components/shell/AccountMenu', () => ({ AccountMenu: () => null }));
vi.mock('@/components/shell/NotificationBell', () => ({ NotificationBell: () => null }));
vi.mock('@/components/ThemeToggle', () => ({ default: () => null }));
vi.mock('@/components/PremiumModal', () => ({ default: () => null }));

import { MedeaLauncher } from '@/components/medea/MedeaLauncher';
import { useAppStore } from '@/lib/store';
import { get } from 'idb-keyval';
import StudyHubClient from '@/app/(app)/documents/[id]/StudyHubClient';
import ReviewClient from '@/app/documents/[id]/review/review-client';
import { TopBar } from '@/components/shell/TopBar';
import { Sidebar } from '@/components/shell/Sidebar';
import { AppShell } from '@/components/shell/AppShell';
import MedeaWelcomeCard from '@/components/dashboard/MedeaWelcomeCard';

const summary: DocumentLifecycleSummary = {
  document: { id: 'ethics-document', filename: 'Ethics.docx', createdAt: '2026-09-01T00:00:00Z', status: 'completed', errorMessage: null },
  extraction: { status: 'completed', errorMessage: null },
  notes: { status: 'ready', outputId: 'notes-1', errorMessage: null },
  quiz: { status: 'ready', outputId: 'quiz-1', errorMessage: null },
  chat: { status: 'ready', lastDiscussedAt: null },
};
const bootstrap: AppBootstrap = {
  user: { id: 'student-1', email: 'student@example.com' },
  entitlements: { premium: false, canChat: true, canGenerateNotes: true, canGenerateQuiz: true },
  credits: { available: 100 },
  economy: { coins: 1000, hearts: 15, heartCap: 15, streak: 1, longestStreak: 1, canRestoreStreak: false, canClaimDailyReward: false, restoreCostCoins: 200, lastClaimedDay: '2026-09-20', studyDay: '2026-09-20', state: 'ok' },
};

describe('MedeaLauncher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    navigation.search = '';
    useAppStore.setState({ chatDrawerOpen: false, medeaRequest: null, activeChatContext: [] });
  });
  afterEach(() => vi.unstubAllGlobals());

  it.each([
    ['topbar', () => <TopBar user={bootstrap.user} credits={bootstrap.credits} />],
    ['sidebar', () => <Sidebar />],
    ['dashboard', () => <MedeaWelcomeCard />],
  ] as const)('opens the %s entry point with fresh global context', (source, element) => {
    useAppStore.getState().openMedea({ source: 'study-hub', documentId: 'old-document' });
    render(element());
    fireEvent.click(screen.getByRole('button', { name: /medea/i }));
    expect(useAppStore.getState().chatDrawerOpen).toBe(true);
    expect(useAppStore.getState().medeaRequest).toMatchObject({ source });
    expect(useAppStore.getState().medeaRequest?.documentId).toBeUndefined();
  });

  it('opens the mobile floating entry point', () => {
    render(<AppShell bootstrap={bootstrap}><p>Dashboard</p></AppShell>);
    const button = screen.getAllByRole('button', { name: /medea/i }).find(item => item.className.includes('fixed'))!;
    fireEvent.click(button);
    expect(useAppStore.getState().medeaRequest).toMatchObject({ source: 'mobile-fab' });
    expect(useAppStore.getState().chatDrawerOpen).toBe(true);
  });

  it('consumes a legacy dashboard deep link without dropping other query parameters', () => {
    navigation.search = 'medea=1&streak=1';
    render(<AppShell bootstrap={bootstrap}><p>Dashboard</p></AppShell>);
    expect(useAppStore.getState().medeaRequest).toMatchObject({ source: 'legacy' });
    expect(useAppStore.getState().chatDrawerOpen).toBe(true);
    expect(navigation.replace).toHaveBeenCalledWith('/dashboard?streak=1', { scroll: false });
  });

  it('opens from Study Hub with that document, without navigating to another chat', () => {
    render(<StudyHubClient initialSummary={summary} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ask Medea' }));
    expect(useAppStore.getState().chatDrawerOpen).toBe(true);
    expect(useAppStore.getState().medeaRequest).toMatchObject({ source: 'study-hub', documentId: 'ethics-document' });
    expect(navigation.push).not.toHaveBeenCalled();
  });

  it('opens from Review with the reviewed document, without navigating', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: async () => ({
      success: true, sessionId: 'session-1', items: [{ id: 'item-1', questionText: 'What is autonomy?', explanation: 'Self-governance.' }],
    }) }));
    render(<ReviewClient documentId="review-document" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Show Answer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ask Medea' }));
    expect(useAppStore.getState().chatDrawerOpen).toBe(true);
    expect(useAppStore.getState().medeaRequest).toMatchObject({ source: 'review', documentId: 'review-document' });
    expect(navigation.push).not.toHaveBeenCalled();
  });

  it('opens the canonical drawer', () => {
    render(<MedeaLauncher source="topbar">Ask Medea</MedeaLauncher>);
    fireEvent.click(screen.getByRole('button', { name: 'Ask Medea' }));
    expect(useAppStore.getState().chatDrawerOpen).toBe(true);
    expect(useAppStore.getState().medeaRequest).toMatchObject({ source: 'topbar' });
    expect(useAppStore.getState().medeaRequest?.documentId).toBeUndefined();
  });

  it('carries the current document and suggested prompt', () => {
    render(<MedeaLauncher documentId="document-123" source="study-hub" suggestedPrompt="Explain this simply">Ask Medea</MedeaLauncher>);
    fireEvent.click(screen.getByRole('button', { name: 'Ask Medea' }));
    expect(useAppStore.getState().chatDrawerOpen).toBe(true);
    expect(useAppStore.getState().medeaRequest).toMatchObject({ documentId: 'document-123', source: 'study-hub', suggestedPrompt: 'Explain this simply' });
  });

  it('does not reuse a document or pinned context on a new global launch', () => {
    useAppStore.getState().openMedea({ documentId: 'old-document', source: 'study-hub' });
    useAppStore.getState().addChatContext({ source_type: 'document', source_name: 'Old lesson', extracted_text: 'Old content' });
    render(<MedeaLauncher source="topbar">Ask Medea</MedeaLauncher>);
    fireEvent.click(screen.getByRole('button', { name: 'Ask Medea' }));
    expect(useAppStore.getState().medeaRequest).toMatchObject({ source: 'topbar' });
    expect(useAppStore.getState().medeaRequest?.documentId).toBeUndefined();
    expect(useAppStore.getState().activeChatContext).toEqual([]);
  });

  it('clears the pending request when closed', () => {
    useAppStore.getState().openMedea({ documentId: 'document-123', source: 'review' });
    useAppStore.getState().setChatDrawerOpen(false);
    expect(useAppStore.getState().chatDrawerOpen).toBe(false);
    expect(useAppStore.getState().medeaRequest).toBeNull();
  });

  it('does not restore stale launch state from older persisted storage', async () => {
    vi.mocked(get).mockResolvedValueOnce(JSON.stringify({ version: 0, state: {
      chatDrawerOpen: true, isMobileNavOpen: true,
      medeaRequest: { documentId: 'old-document', source: 'review', nonce: 1 },
      activeChatContext: [{ id: 'old', source_type: 'document', source_name: 'Old lesson', extracted_text: 'Old content', timestamp: 1 }],
    } }));
    await useAppStore.persist.rehydrate();
    expect(useAppStore.getState().chatDrawerOpen).toBe(false);
    expect(useAppStore.getState().medeaRequest).toBeNull();
    expect(useAppStore.getState().activeChatContext).toEqual([]);
    expect(useAppStore.getState().isMobileNavOpen).toBe(false);
  });

  it('respects disabled and does not submit a parent form', () => {
    const submit = vi.fn();
    const { rerender } = render(<form onSubmit={submit}><MedeaLauncher disabled source="topbar">Ask Medea</MedeaLauncher></form>);
    fireEvent.click(screen.getByRole('button', { name: 'Ask Medea' }));
    expect(useAppStore.getState().chatDrawerOpen).toBe(false);
    rerender(<form onSubmit={submit}><MedeaLauncher source="topbar">Ask Medea</MedeaLauncher></form>);
    fireEvent.click(screen.getByRole('button', { name: 'Ask Medea' }));
    expect(submit).not.toHaveBeenCalled();
  });
});
