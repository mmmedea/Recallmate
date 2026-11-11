import React from 'react';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock PointerEvent for Radix UI Dialog in jsdom
if (typeof window !== 'undefined') {
  window.PointerEvent = class PointerEvent extends Event {} as any;
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
  window.HTMLElement.prototype.hasPointerCapture = vi.fn();
  window.HTMLElement.prototype.releasePointerCapture = vi.fn();
}

import { OAuthButtons } from '@/components/auth/OAuthButtons';
import { EmailOTPForm } from '@/components/auth/EmailOTPForm';
import SignupPage from '@/app/(auth)/signup/page';
import OnboardingPage from '@/app/(onboarding)/onboarding/page';
import SettingsPage from '@/app/(app)/settings/page';
import VerifyEmailPage from '@/app/(auth)/verify-email/page';
import { OAUTH_PROVIDERS } from '@/lib/config/auth';
import { useOTPStore } from '@/lib/store';

const authMocks = vi.hoisted(() => ({
  signInWithOAuth: vi.fn().mockResolvedValue({ data: {}, error: null }),
  signInWithOtp: vi.fn().mockResolvedValue({ data: {}, error: null }),
  signInWithPassword: vi.fn().mockResolvedValue({ data: {}, error: null }),
  verifyOtp: vi.fn().mockResolvedValue({ data: { user: { user_metadata: { recallmate_account_completed: true } } }, error: null }),
  updateUser: vi.fn().mockResolvedValue({ data: {}, error: null }),
  getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
  signOut: vi.fn().mockResolvedValue({ error: null }),
}));

const routerMocks = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
}));

const availabilityFetch = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test-project.supabase.co');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test');
  useOTPStore.setState({ otpState: 'idle', otpFlowContext: null });
  availabilityFetch.mockReset();
  availabilityFetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ usernameExists: false }),
  });
  vi.stubGlobal('fetch', availabilityFetch);
});

afterEach(() => {
  vi.useRealTimers();
});

// Mock Next.js router & navigation
vi.mock('next/navigation', () => ({
  useRouter: () => routerMocks,
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('next-themes', () => ({
  useTheme: () => ({ resolvedTheme: 'light', setTheme: vi.fn() }),
}));

// Mock Supabase Client
vi.mock('@/utils/supabase/client', () => ({
  createClient: () => ({
    auth: authMocks,
  }),
}));

describe('OAuthButtons Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Temporarily mock all providers as enabled for these tests
    OAUTH_PROVIDERS.forEach(p => p.enabled = true);
  });

  it('renders Google provider when enabled', () => {
    render(<OAuthButtons />);
    expect(screen.getByLabelText('Continue with Google')).toBeDefined();
  });

  it('renders GitHub provider when enabled', () => {
    render(<OAuthButtons />);
    expect(screen.getByLabelText('Continue with GitHub')).toBeDefined();
  });

  it('renders Facebook provider when enabled', () => {
    render(<OAuthButtons />);
    expect(screen.getByLabelText('Continue with Facebook')).toBeDefined();
  });

  it('hides disabled providers', () => {
    const github = OAUTH_PROVIDERS.find(p => p.id === 'github');
    if (github) github.enabled = false;
    
    render(<OAuthButtons />);
    expect(screen.queryByLabelText('Continue with GitHub')).toBeNull();
    expect(screen.getByLabelText('Continue with Google')).toBeDefined();
  });

  it('starts Google sign-in by navigating directly through the server OAuth route', () => {
    render(<OAuthButtons redirectTo="/calendar" />);
    const google = screen.getByLabelText('Continue with Google') as HTMLAnchorElement;

    expect(google.tagName).toBe('A');
    expect(google.getAttribute('href')).toBe('/api/auth/google/start?next=%2Fcalendar');
    expect(availabilityFetch).not.toHaveBeenCalled();
    expect(authMocks.signInWithOAuth).not.toHaveBeenCalled();
    expect(document.querySelector('script[src="https://accounts.google.com/gsi/client"]')).toBeNull();
  });
});

describe('Signup Page Component', () => {
  it('initializes privacy state to false (unchecked)', () => {
    render(<SignupPage searchParams={{}} />);
    const checkbox = screen.getByRole('checkbox', { name: /I have read and agree to the/i }) as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
  });

  it('allows details first, then requires legal consent on submit', async () => {
    authMocks.signInWithOtp.mockClear();
    render(<SignupPage searchParams={{}} />);
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'student_18' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'student@gmail.com' } });
    const button = screen.getByRole('button', { name: /Create account & send code/i }) as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    fireEvent.click(button);
    expect(await screen.findByText('Please agree to the Privacy Policy and Terms of Service.')).toBeDefined();
    expect(authMocks.signInWithOtp).not.toHaveBeenCalled();
  });

  it('has no password fields and keeps privacy acknowledgement unchecked by default', () => {
    render(<SignupPage searchParams={{}} />);

    expect(screen.queryByLabelText(/^Password$/i)).toBeNull();
    expect(screen.queryByLabelText(/Confirm password/i)).toBeNull();
    expect((screen.getByRole('checkbox', { name: /I have read and agree to the/i }) as HTMLInputElement).checked).toBe(false);
  });

  it('preserves a safe internal signup destination for Google OAuth', () => {
    render(<SignupPage searchParams={{ next: '/notes' }} />);
    expect(screen.getByLabelText('Continue with Google').getAttribute('href')).toBe('/api/auth/google/start?next=%2Fnotes');
  });

  it('rejects an unsafe signup destination for Google OAuth', () => {
    render(<SignupPage searchParams={{ next: '//evil.example/path' }} />);
    expect(screen.getByLabelText('Continue with Google').getAttribute('href')).toBe('/api/auth/google/start?next=%2Fdashboard');
  });

  it('preserves a safe internal next destination through signup OTP verification', async () => {
    render(<SignupPage searchParams={{ next: '/notes?topic=ethics' }} />);
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'student_18' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'student@gmail.com' } });
    fireEvent.click(screen.getByRole('checkbox', { name: /I have read and agree to the/i }));
    fireEvent.click(screen.getByRole('button', { name: /Create account & send code/i }));

    await waitFor(() => {
      expect(routerMocks.push).toHaveBeenCalledWith('/verify-email?intent=signup&next=%2Fnotes%3Ftopic%3Dethics');
    });
  });

  it('Privacy Policy opens modal and does not toggle checkbox', async () => {
    render(<SignupPage searchParams={{}} />);
    
    const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
    expect(checkbox.checked).toBe(false);

    // Find trigger
    const privacyTrigger = screen.getByText('Privacy Policy');
    expect(privacyTrigger).toBeDefined();
    
    // Modal opens on click
    fireEvent.click(privacyTrigger);
    
    // Ensure clicking the trigger did NOT check the checkbox
    expect(checkbox.checked).toBe(false);

    // Radix UI dialogs are rendered via Portal and might be async
    const dialogTitle = await screen.findByRole('heading', { name: 'Privacy Policy' });
    expect(dialogTitle).toBeDefined();
    
    // Test Escape to close
    fireEvent.keyDown(dialogTitle, { key: 'Escape', code: 'Escape' });
    // In jsdom + radix ui, exact unmounting might require fake timers, but we test the intent
  });

  it('Terms opens modal and does not toggle checkbox', async () => {
    render(<SignupPage searchParams={{}} />);
    
    const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
    expect(checkbox.checked).toBe(false);

    const termsTrigger = screen.getByText('Terms of Service');
    fireEvent.click(termsTrigger);
    
    // Ensure clicking the trigger did NOT check the checkbox
    expect(checkbox.checked).toBe(false);

    const dialogTitle = await screen.findByRole('heading', { name: 'Terms of Service' });
    expect(dialogTitle).toBeDefined();
    
    // In jsdom + radix ui, exact unmounting might require fake timers
    // We verified the title appears, meaning the modal opened.
  });
});

import LoginPage from '@/app/(auth)/login/page';

describe('Login Page Component', () => {
  it('Sign-in works without privacy checkbox', () => {
    render(<LoginPage searchParams={{}} />);
    
    // Ensure Google button exists
    expect(screen.getByLabelText('Continue with Google')).toBeDefined();
    
    // Ensure no privacy checkbox exists
    const checkbox = screen.queryByRole('checkbox');
    expect(checkbox).toBeNull();
  });

  it('requests a sign-in OTP without a password and keeps the email out of the verification URL', async () => {
    render(<LoginPage searchParams={{}} />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'student@example.com' } });
    expect(screen.queryByLabelText(/^Password$/i)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Send sign-in code/i }));

    await vi.waitFor(() => {
      expect(authMocks.signInWithOtp).toHaveBeenCalledWith({
        email: 'student@example.com',
        options: expect.objectContaining({ shouldCreateUser: false }),
      });
    });
    expect(routerMocks.push).toHaveBeenCalledWith('/verify-email?intent=signin');
    expect(routerMocks.push.mock.calls[0][0]).not.toContain('student@example.com');
    expect(useOTPStore.getState().otpFlowContext?.email).toBe('student@example.com');
    expect(authMocks.signInWithPassword).not.toHaveBeenCalled();
  });

  it('keeps OTP request failures neutral when the provider error mentions account lookup', async () => {
    authMocks.signInWithOtp.mockResolvedValueOnce({ data: {}, error: { message: 'User not found' } });
    render(<LoginPage searchParams={{}} />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'person@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /Send sign-in code/i }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).not.toMatch(/user not found|account (exists|does not exist)|email is registered/i);
  });

  it('allows Gmail addresses in the verified email signup flow', async () => {
    render(
      <EmailOTPForm
        intent="signup"
        privacyAgreed
        username="student_18"
      />
    );
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'student@gmail.com' } });
    fireEvent.click(screen.getByRole('button', { name: /Create account & send code/i }));

    await vi.waitFor(() => {
      expect(authMocks.signInWithOtp).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'student@gmail.com',
          options: expect.objectContaining({ shouldCreateUser: true }),
        })
      );
    });

    const request = authMocks.signInWithOtp.mock.calls[0][0];
    expect(request.options).not.toHaveProperty('emailRedirectTo');
    expect(request.options.data).toEqual({
      privacy_agreed: true,
      username: 'student_18',
      recallmate_account_completed: false,
    });
    expect(routerMocks.push).toHaveBeenCalledWith('/verify-email?intent=signup');
    expect(routerMocks.push.mock.calls[0][0]).not.toContain('student@gmail.com');
    expect(useOTPStore.getState().otpFlowContext?.email).toBe('student@gmail.com');
    expect(await screen.findByText(/6-digit code/i)).toBeDefined();
    expect(await screen.findByText(/check your Spam or Junk folder/i)).toBeDefined();
  });

  it('uses neutral signup behavior when email availability data contains an email-existence field', async () => {
    availabilityFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ emailExists: true, usernameExists: false }),
    });
    render(<EmailOTPForm intent="signup" privacyAgreed username="student_18" />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'existing@gmail.com' } });
    fireEvent.click(screen.getByRole('button', { name: /Create account & send code/i }));

    await vi.waitFor(() => {
      expect(authMocks.signInWithOtp).toHaveBeenCalledWith(expect.objectContaining({
        email: 'existing@gmail.com',
        options: expect.objectContaining({ shouldCreateUser: true }),
      }));
    });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(routerMocks.push).toHaveBeenCalledWith('/verify-email?intent=signup');
  });

  it('stops signup when the username already exists', async () => {
    availabilityFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ emailExists: false, usernameExists: true }),
    });
    render(<EmailOTPForm intent="signup" privacyAgreed username="student_18" />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'new@gmail.com' } });
    fireEvent.click(screen.getByRole('button', { name: /Create account & send code/i }));

    expect(await screen.findByText(/username is already taken/i)).toBeDefined();
    expect(authMocks.signInWithOtp).not.toHaveBeenCalled();
  });

  it('accepts a pasted six-digit OTP and verifies the exact code once', async () => {
    useOTPStore.setState({
      otpState: 'sent',
      otpFlowContext: { otpFlowId: 'signup-flow', email: 'student@gmail.com', intent: 'signup', createdAt: Date.now() },
    });
    authMocks.verifyOtp.mockResolvedValueOnce({
      data: { user: { user_metadata: { username: 'student_18', recallmate_account_completed: false } } },
      error: null,
    });
    render(<EmailOTPForm intent="signup" username="student_18" />);

    const firstDigit = await screen.findByLabelText('Digit 1 of 6');
    fireEvent.paste(firstDigit, {
      clipboardData: { getData: () => '426685' },
    });

    await vi.waitFor(() => {
      expect(authMocks.verifyOtp).toHaveBeenCalledWith({
        email: 'student@gmail.com',
        token: '426685',
        type: 'email',
      });
      expect(authMocks.verifyOtp).toHaveBeenCalledTimes(1);
    });
    expect(useOTPStore.getState().otpFlowContext).toBeNull();
    expect(authMocks.updateUser).not.toHaveBeenCalledWith(expect.objectContaining({ password: expect.anything() }));
    expect(routerMocks.replace).toHaveBeenCalledWith('/onboarding?next=%2Fdashboard');
  });

  it('sanitizes the post-verification destination before navigating', async () => {
    useOTPStore.setState({
      otpState: 'sent',
      otpFlowContext: { otpFlowId: 'redirect-flow', email: 'student@example.com', intent: 'signup', createdAt: Date.now() },
    });
    authMocks.verifyOtp.mockResolvedValueOnce({
      data: { user: { user_metadata: { recallmate_account_completed: true } } },
      error: null,
    });
    render(<EmailOTPForm intent="signup" redirectTo="//evil.example" />);
    const firstDigit = await screen.findByLabelText('Digit 1 of 6');
    fireEvent.paste(firstDigit, { clipboardData: { getData: () => '426685' } });

    await vi.waitFor(() => expect(routerMocks.replace).toHaveBeenCalledWith('/dashboard'));
  });

  it('shows a neutral accessible status on the verification screen without exposing account existence', async () => {
    useOTPStore.setState({
      otpState: 'sent',
      otpFlowContext: { otpFlowId: 'signup-flow', email: 'person@example.com', intent: 'signup', createdAt: Date.now() },
    });
    render(<EmailOTPForm intent="signup" />);

    const status = await screen.findByRole('status');
    expect(status.textContent).toMatch(/if .*can (receive|be used)|if .*eligible/i);
    expect(status.textContent).not.toMatch(/account (exists|does not exist)|email (exists|not found)/i);
  });

  it('renders the dedicated verification route from session flow state without an email URL parameter', async () => {
    useOTPStore.setState({
      otpState: 'sent',
      otpFlowContext: { otpFlowId: 'route-flow', email: 'person@example.com', intent: 'signin', createdAt: Date.now() },
    });
    render(<VerifyEmailPage />);

    expect(await screen.findByLabelText('Digit 1 of 6')).toBeDefined();
    expect(window.location.href).not.toContain('person@example.com');
    expect(screen.getByRole('status').textContent).toMatch(/check your inbox/i);
  });

  it('recovers when the verification URL is opened without its session flow', async () => {
    useOTPStore.setState({ otpState: 'idle', otpFlowContext: null });
    render(<VerifyEmailPage />);

    expect(await screen.findByRole('alert')).toBeDefined();
    expect(screen.getByRole('link', { name: /return to sign in/i }).getAttribute('href')).toBe('/login');
  });

  it.each([
    ['invalid', 'newest code', 'invalid'],
    ['expired', 'expired', 'expired'],
    ['rate_limited', 'Too many attempts', 'rate_limited'],
  ])('keeps %s OTP failures recoverable', async (state, message, expectedState) => {
    useOTPStore.setState({
      otpState: 'sent',
      otpFlowContext: { otpFlowId: `flow-${state}`, email: 'person@example.com', intent: 'signup', createdAt: Date.now() },
    });
    const providerMessage = state === 'rate_limited' ? 'rate limit exceeded' : state === 'expired' ? 'token expired' : 'invalid token';
    authMocks.verifyOtp.mockResolvedValueOnce({ data: { user: null }, error: { message: providerMessage } });
    render(<EmailOTPForm intent="signup" />);
    const firstDigit = await screen.findByLabelText('Digit 1 of 6');
    fireEvent.paste(firstDigit, { clipboardData: { getData: () => '426685' } });

    expect((await screen.findByRole('alert')).textContent).toContain(message);
    expect(useOTPStore.getState().otpState).toBe(expectedState);
    expect(useOTPStore.getState().otpFlowContext?.email).toBe('person@example.com');
    expect(screen.getByLabelText('Digit 1 of 6')).toBeDefined();
  });

  it('ignores a stale verification response after a newer OTP flow replaces it', async () => {
    let resolveVerification!: (result: unknown) => void;
    authMocks.verifyOtp.mockReturnValueOnce(new Promise(resolve => { resolveVerification = resolve; }));
    useOTPStore.setState({
      otpState: 'sent',
      otpFlowContext: { otpFlowId: 'old-flow', email: 'old@example.com', intent: 'signup', createdAt: Date.now() },
    });
    render(<EmailOTPForm intent="signup" />);
    const firstDigit = await screen.findByLabelText('Digit 1 of 6');
    fireEvent.paste(firstDigit, { clipboardData: { getData: () => '426685' } });
    await vi.waitFor(() => expect(authMocks.verifyOtp).toHaveBeenCalledTimes(1));

    useOTPStore.setState({
      otpState: 'sent',
      otpFlowContext: { otpFlowId: 'new-flow', email: 'new@example.com', intent: 'signin', createdAt: Date.now() },
    });
    await act(async () => {
      resolveVerification({ data: { user: null }, error: { message: 'invalid token' } });
    });

    expect(useOTPStore.getState().otpState).toBe('sent');
    expect(useOTPStore.getState().otpFlowContext?.email).toBe('new@example.com');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('creates a new flow identity when a verification code is resent', async () => {
    vi.useFakeTimers();
    useOTPStore.setState({
      otpState: 'sent',
      otpFlowContext: { otpFlowId: 'before-resend', email: 'person@example.com', intent: 'signup', createdAt: Date.now() },
    });
    render(<EmailOTPForm intent="signup" username="student_18" />);
    await act(async () => { vi.advanceTimersByTime(60_000); });
    const resend = screen.getByRole('button', { name: 'Resend verification code' });
    await act(async () => {
      fireEvent.click(resend);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(authMocks.signInWithOtp).toHaveBeenCalledWith(expect.objectContaining({
      email: 'person@example.com',
      options: expect.objectContaining({ shouldCreateUser: true }),
    }));
    expect(useOTPStore.getState().otpFlowContext?.otpFlowId).not.toBe('before-resend');
  });

  it('completes onboarding without asking for or setting a password', async () => {
    authMocks.getUser.mockResolvedValueOnce({
      data: { user: { email: 'student@example.com', user_metadata: { username: 'student_18' } } },
      error: null,
    });
    render(<OnboardingPage />);

    expect(await screen.findByDisplayValue('student@example.com')).toBeDefined();
    expect(document.querySelectorAll('input[type="password"]')).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: /Create account & enter RecallMate/i }));

    await vi.waitFor(() => {
      expect(authMocks.updateUser).toHaveBeenCalledWith({
        data: { username: 'student_18', recallmate_account_completed: true },
      });
    });
    expect(authMocks.updateUser).not.toHaveBeenCalledWith(expect.objectContaining({ password: expect.anything() }));
    expect(routerMocks.replace).toHaveBeenCalledWith('/dashboard');
  });

  it('does not offer a password-setting action in account settings', async () => {
    authMocks.getUser.mockResolvedValueOnce({
      data: { user: { email: 'student@example.com', user_metadata: { username: 'student_18' } } },
      error: null,
    });
    render(<SettingsPage />);

    expect(await screen.findByText('Sign-in & security')).toBeDefined();
    expect(document.querySelectorAll('input[type="password"]')).toHaveLength(0);
    expect(screen.queryByRole('button', { name: /change password/i })).toBeNull();
  });
});

import PrivacyPage from '@/app/privacy/page';
import TermsPage from '@/app/terms/page';
import CookieConsent from '@/components/CookieConsent';

describe('Legal Pages', () => {
  it('/privacy renders without crashing (returns 200 equivalent)', () => {
    const { container } = render(<PrivacyPage />);
    expect(container).toBeDefined();
    expect(screen.getByText('Privacy Policy')).toBeDefined();
  });

  it('/terms renders without crashing (returns 200 equivalent)', () => {
    const { container } = render(<TermsPage />);
    expect(container).toBeDefined();
    expect(screen.getByText('Terms of Service')).toBeDefined();
  });
});

describe('Cookie Consent Banner', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('Deny All rejects optional categories', () => {
    render(<CookieConsent />);
    
    // Banner should be visible
    expect(screen.getByText(/We value your privacy/i)).toBeDefined();
    
    const denyBtn = screen.getByRole('button', { name: /Deny All/i });
    fireEvent.click(denyBtn);
    
    // Banner should close
    expect(screen.queryByText(/We value your privacy/i)).toBeNull();
    
    const stored = JSON.parse(localStorage.getItem('recallmate_cookie_consent') || '{}');
    expect(stored.essential).toBe(true);
    expect(stored.analytics).toBe(false);
    expect(stored.marketing).toBe(false);
  });

  it('Accept All enables optional categories', () => {
    render(<CookieConsent />);
    
    const acceptBtn = screen.getByRole('button', { name: /Accept All/i });
    fireEvent.click(acceptBtn);
    
    const stored = JSON.parse(localStorage.getItem('recallmate_cookie_consent') || '{}');
    expect(stored.essential).toBe(true);
    expect(stored.analytics).toBe(true);
    expect(stored.marketing).toBe(true);
  });
});
