// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
const client = vi.hoisted(() => ({ auth: { getSession: vi.fn(async () => ({ data: { session: { access_token: 'test' } } })) } }));
vi.mock('@/utils/supabase/client', () => ({ createClient: () => client }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
import { QuizClient } from '@/app/(app)/quiz/[documentId]/QuizClient';

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it('keeps the same logical review ID after a failed response and retry', async () => {
  const requests: any[] = [];
  vi.spyOn(window, 'alert').mockImplementation(() => {});
  vi.stubGlobal('fetch', vi.fn(async (url, options) => {
    if (url === '/api/learning/session') return {
      ok: true, json: async () => ({ sessionId: 'session-one', items: [{
        learningItemId: 'item-one', questionId: 'question-one', questionText: 'Choose an answer',
        options: ['Right', 'Wrong'], correctAnswerIndex: 0, explanation: 'Explanation', state: 0,
      }] }),
    };
    requests.push(JSON.parse(options.body));
    return { ok: requests.length > 1, json: async () => requests.length === 1
      ? { error: 'Response interrupted' }
      : { success: true, economy: { hearts: 17, heartCap: 15, heartsDelta: -1 } } };
  }));
  render(<QuizClient documentId="document-one" />);
  fireEvent.click(await screen.findByRole('button', { name: /Wrong/ }));
  fireEvent.click(screen.getByRole('button', { name: /Again/ }));
  await waitFor(() => expect(window.alert).toHaveBeenCalled());
  fireEvent.click(screen.getByRole('button', { name: /Again/ }));
  await waitFor(() => expect(requests).toHaveLength(2));
  expect(requests[0].requestId).toBe(requests[1].requestId);
  expect(requests[0].wasCorrect).toBe(false);
});

it('records the final heart answer, pauses, and resumes the same quiz after purchase', async () => {
  const calls: { url: string; body: any }[] = [];
  const items = [1, 2].map(n => ({ learningItemId: `item-${n}`, questionId: `question-${n}`,
    questionText: `Question ${n}`, options: ['Right', 'Wrong'], correctAnswerIndex: 0, explanation: '', state: 0 }));
  vi.stubGlobal('fetch', vi.fn(async (url, options) => {
    calls.push({ url, body: options?.body ? JSON.parse(options.body) : null });
    if (url === '/api/learning/session') return { ok: true, json: async () => ({ sessionId: 'same-session', items }) };
    if (url === '/api/learning/review') return { ok: true, json: async () => ({ success: true, premium: false, economy: { hearts: 0, heartCap: 15, heartsDelta: -1 } }) };
    if (url === '/api/economy/heart-shop') return { ok: true, json: async () => ({ success: true }) };
    return { ok: true, json: async () => ({ premium: false, economy: { state: 'ok', hearts: 5, heartCap: 15 } }) };
  }));
  render(<QuizClient documentId="document-one" />);
  fireEvent.click(await screen.findByRole('button', { name: /Wrong/ }));
  fireEvent.click(screen.getByRole('button', { name: /Again/ }));
  expect(await screen.findByRole('heading', { name: "You're out of hearts" })).toBeDefined();
  expect(screen.queryByText('Question 2')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: /200 coins/ }));
  expect(await screen.findByText('Question 2')).toBeDefined();
  expect(calls.filter(c => c.url === '/api/learning/session')).toHaveLength(1);
  expect(calls.find(c => c.url === '/api/economy/heart-shop')?.body.kind).toBe('add_five');
  expect(calls.filter(c => c.url === '/api/learning/review')).toHaveLength(1);
});

it('does not pause a Premium student at zero hearts', async () => {
  vi.stubGlobal('fetch', vi.fn(async (url) => ({ ok: true, json: async () => url === '/api/learning/session'
    ? { sessionId: 'premium-session', items: [1, 2].map(n => ({ learningItemId: `item-${n}`, questionId: `q-${n}`,
      questionText: `Premium question ${n}`, options: ['Right', 'Wrong'], correctAnswerIndex: 0, explanation: '', state: 0 })) }
    : { success: true, premium: true, economy: { hearts: 0, heartCap: 15, heartsDelta: 0 } } })));
  render(<QuizClient documentId="document-one" />);
  fireEvent.click(await screen.findByRole('button', { name: /Wrong/ }));
  fireEvent.click(screen.getByRole('button', { name: /Again/ }));
  expect(await screen.findByText('Premium question 2')).toBeDefined();
  expect(screen.queryByText("You're out of hearts")).toBeNull();
});
